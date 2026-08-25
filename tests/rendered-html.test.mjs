import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the task-specific review workflow", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Review Passport/);
  assert.match(html, /TRUST IS A CHAIN OF EVIDENCE/);
  assert.match(html, /Run 4-step workflow/);
  assert.match(html, /Source Scout/);
  assert.match(html, /Trust Auditor/);
  assert.match(html, /Publish Gate/);
  assert.match(html, /Editable Korean source/);
  assert.match(html, /Unit bug/);
  assert.match(html, /Near duplicate/);
  assert.match(html, /Policy risk/);
  assert.match(html, /At-scale safeguards/);
  assert.match(html, /Idempotent ingest/);
  assert.match(html, /Edit review/);
  assert.match(html, /Trust audit/);
  assert.doesNotMatch(html, /href="#workflow">Procedures/);
  assert.doesNotMatch(html, /Review passport · #GBG-0241/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("edited Korean input flows through extraction and price validation", async () => {
  const { runReviewWorkflow } = await import("../lib/review-workflow.ts");
  const custom = "서울피부과에서 레이저 했어요. 45만원 들었고 회복은 3일 정도였어요.";
  const result = await runReviewWorkflow(() => {}, custom);
  assert.equal(result.sourced.original_korean, custom);
  assert.equal(result.sourced.evidence_spans.clinic, "서울피부과");
  assert.equal(result.normalized.procedure.taxonomy_id, "skin.laser");
  assert.equal(result.audited.corrected_price_krw, 450_000);
  assert.equal(result.gate.decision, "hold_for_human");
});

test("agent chain repairs Korean price units and blocks unsafe publishing", async () => {
  const { runReviewWorkflow } = await import("../lib/review-workflow.ts");
  const events = [];
  const result = await runReviewWorkflow((event) => events.push(event));
  assert.equal(result.normalized.price_candidate_krw, 350_000);
  assert.equal(result.audited.corrected_price_krw, 3_500_000);
  assert.equal(result.audited.repairs[0].rule, "KRW_MANWON_UNIT");
  assert.equal(result.gate.decision, "hold_for_human");
  assert.deepEqual(
    events.filter((event) => event.status === "complete" || event.status === "warning").map((event) => event.id),
    ["source", "normalize", "audit", "publish"],
  );
});

test("duplicate review is quarantined instead of published", async () => {
  const { reviewExamples, runReviewWorkflow } = await import("../lib/review-workflow.ts");
  const result = await runReviewWorkflow(() => {}, reviewExamples[2].raw);
  assert.equal(result.audited.duplicate_search.matched_review_id, "GBG-0198");
  assert.equal(result.audited.policy_checks.duplicate.status, "quarantine");
  assert.ok(result.gate.queues.includes("duplicate-quarantine"));
  assert.equal(result.gate.decision, "hold_for_human");
});

test("policy-risk review redacts contact data and routes disclosure review", async () => {
  const { reviewExamples, runReviewWorkflow } = await import("../lib/review-workflow.ts");
  const result = await runReviewWorkflow(() => {}, reviewExamples[3].raw);
  assert.doesNotMatch(result.normalized.safe_original_korean, /010-1234-5678/);
  assert.match(result.normalized.safe_original_korean, /\[CONTACT REDACTED\]/);
  assert.equal(result.audited.policy_checks.pii.status, "redacted_and_blocked");
  assert.equal(result.audited.policy_checks.sponsorship.status, "disclosure_review");
  assert.ok(result.gate.queues.includes("privacy-review"));
  assert.ok(result.gate.queues.includes("disclosure-review"));
});
