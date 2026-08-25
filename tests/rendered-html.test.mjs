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
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
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
