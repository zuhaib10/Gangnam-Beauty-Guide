export type StepId = "source" | "normalize" | "audit" | "publish";
export type StepStatus = "waiting" | "running" | "complete" | "warning";

export type WorkflowEvent = {
  id: StepId;
  status: StepStatus;
  duration?: number;
  summary?: string;
  output?: Record<string, unknown>;
};

export const incomingReview = {
  id: "GBG-0241",
  source: "Naver Café · 여우야",
  sourceUrl: "cafe.naver.com/yeouya/893217",
  capturedAt: "2026-08-25T02:21:04Z",
  raw: "엘리트성형외과에서 자연유착 쌍꺼풀 했어요. 상담해주신 김원장님이 과하게 권하지 않아서 좋았고 350만원 들었어요. 붓기는 2주 정도 갔고 지금은 자연스러워요.",
  snapshotSha: "8da3c1a74f91",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sourceScout() {
  return {
    source_kind: "community_forum",
    locale: "ko-KR",
    captured_at: incomingReview.capturedAt,
    immutable_snapshot: `sha256:${incomingReview.snapshotSha}`,
    evidence_spans: {
      clinic: "엘리트성형외과",
      procedure: "자연유착 쌍꺼풀",
      surgeon: "김원장님",
      price_raw: "350만원",
      recovery_raw: "붓기는 2주 정도",
    },
    disclosure: "No sponsorship disclosure found",
  };
}

function normalizer(source: ReturnType<typeof sourceScout>) {
  // This deliberately preserves a production bug we hit: a generic parser treated
  // 만원 as 1,000 KRW. The next contract owns validation and repair.
  const legacyPriceCandidate = Number(source.evidence_spans.price_raw.match(/\d+/)?.[0]) * 1_000;

  return {
    translated_review:
      "I had natural-adhesion double-eyelid surgery at Elite Plastic Surgery. Dr. Kim did not push unnecessary procedures, which I appreciated. It cost ₩3.5 million. Swelling lasted about two weeks and the result now looks natural.",
    clinic_candidates: [
      { clinic_id: "kr-seoul-elite-ps-01", name: "Elite Plastic Surgery", confidence: 0.71 },
      { clinic_id: "kr-seoul-the-elite-07", name: "The Elite Clinic", confidence: 0.63 },
    ],
    procedure: { taxonomy_id: "eye.double-eyelid.natural-adhesion", confidence: 0.96 },
    surgeon: { display_name: "Dr. Kim", verified_id: null, confidence: 0.42 },
    price_candidate_krw: legacyPriceCandidate,
    price_source_span: source.evidence_spans.price_raw,
    recovery_days: 14,
    translation_confidence: 0.91,
  };
}

function audit(normalized: ReturnType<typeof normalizer>) {
  const unitMatch = normalized.price_source_span.match(/([\d.]+)만원/);
  const guardedPrice = unitMatch ? Number(unitMatch[1]) * 10_000 : normalized.price_candidate_krw;
  const priceRepaired = guardedPrice !== normalized.price_candidate_krw;
  const clinicNeedsReview = normalized.clinic_candidates[0].confidence < 0.85;
  const surgeonNeedsReview = !normalized.surgeon.verified_id;

  return {
    corrected_price_krw: guardedPrice,
    repairs: priceRepaired
      ? [{ rule: "KRW_MANWON_UNIT", from: normalized.price_candidate_krw, to: guardedPrice, severity: "critical" }]
      : [],
    duplicate_search: { top_similarity: 0.18, matched_review_id: null, threshold: 0.86 },
    source_integrity: { snapshot_match: true, evidence_spans_preserved: true },
    entity_resolution: {
      clinic: clinicNeedsReview ? "human_confirmation_required" : "resolved",
      surgeon: surgeonNeedsReview ? "unverified" : "verified",
    },
    trust_score: 78,
    publishable: !clinicNeedsReview && !surgeonNeedsReview && !priceRepaired,
    blockers: [
      ...(clinicNeedsReview ? ["Clinic match is below the 0.85 auto-link threshold"] : []),
      ...(surgeonNeedsReview ? ["‘Dr. Kim’ cannot be tied to a verified surgeon record"] : []),
      ...(priceRepaired ? ["Critical price repair requires reviewer acknowledgement"] : []),
    ],
  };
}

function publishGate(audited: ReturnType<typeof audit>) {
  return {
    decision: audited.publishable ? "publish" : "hold_for_human",
    queue: "entity-and-price-review",
    immutable_fields: ["source_url", "snapshot_sha", "original_korean", "repair_log"],
    public_badges: ["Source archived", "Procedure evidence found", "Human checked translation"],
    hidden_badges: ["Verified surgeon"],
    reason: audited.blockers,
  };
}

export async function runReviewWorkflow(onEvent: (event: WorkflowEvent) => void) {
  onEvent({ id: "source", status: "running" });
  await wait(650);
  const sourced = sourceScout();
  onEvent({ id: "source", status: "complete", duration: 612, summary: "Snapshot locked; 5 evidence spans extracted", output: sourced });

  onEvent({ id: "normalize", status: "running" });
  await wait(760);
  const normalized = normalizer(sourced);
  onEvent({ id: "normalize", status: "warning", duration: 741, summary: "Translated; 2 clinic candidates; price unit uncertain", output: normalized });

  onEvent({ id: "audit", status: "running" });
  await wait(820);
  const audited = audit(normalized);
  onEvent({ id: "audit", status: "warning", duration: 801, summary: "Caught 10× price error; surgeon unresolved", output: audited });

  onEvent({ id: "publish", status: "running" });
  await wait(580);
  const gate = publishGate(audited);
  onEvent({ id: "publish", status: "complete", duration: 557, summary: "Held for human review; nothing auto-published", output: gate });

  return { sourced, normalized, audited, gate };
}
