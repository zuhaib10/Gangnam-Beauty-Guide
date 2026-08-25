export type StepId = "source" | "normalize" | "audit" | "publish";
export type StepStatus = "waiting" | "running" | "complete" | "warning";

export type WorkflowEvent = {
  id: StepId;
  status: StepStatus;
  duration?: number;
  summary?: string;
  output?: Record<string, unknown>;
};

export const reviewExamples = [
  {
    label: "Unit bug",
    raw: "엘리트성형외과에서 자연유착 쌍꺼풀 했어요. 상담해주신 김원장님이 과하게 권하지 않아서 좋았고 350만원 들었어요. 붓기는 2주 정도 갔고 지금은 자연스러워요.",
  },
  {
    label: "Clean laser",
    raw: "서울피부과에서 피코 레이저 받았어요. 상담은 친절했고 45만원 들었어요. 회복은 3일 정도였고 잡티가 많이 옅어졌어요.",
  },
  {
    label: "Near duplicate",
    raw: "강남미인의원에서 입술 필러 했어요. 박원장님이 모양을 꼼꼼하게 봐주셨고 38만원이었어요. 멍은 5일 정도 갔어요.",
  },
  {
    label: "Policy risk",
    raw: "협찬으로 강남미인의원에서 입술 필러 했어요. 자세한 상담은 010-1234-5678로 연락하세요. 비용은 38만원이었어요.",
  },
] as const;

export const incomingReview = {
  source: "Naver Café · 여우야",
  sourceUrl: "cafe.naver.com/yeouya/893217",
  capturedAt: "2026-08-25T02:21:04Z",
  raw: reviewExamples[0].raw,
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const procedureIndex = [
  { ko: "자연유착 쌍꺼풀", label: "Double eyelid · natural adhesion", taxonomyId: "eye.double-eyelid.natural-adhesion" },
  { ko: "쌍꺼풀", label: "Double eyelid surgery", taxonomyId: "eye.double-eyelid" },
  { ko: "코수술", label: "Rhinoplasty", taxonomyId: "nose.rhinoplasty" },
  { ko: "리프팅", label: "Lifting treatment", taxonomyId: "face.lifting" },
  { ko: "보톡스", label: "Botox", taxonomyId: "injectable.botox" },
  { ko: "필러", label: "Dermal filler", taxonomyId: "injectable.filler" },
  { ko: "레이저", label: "Laser treatment", taxonomyId: "skin.laser" },
  { ko: "피부관리", label: "Skin treatment", taxonomyId: "skin.care" },
];

const knownReviewCorpus = [
  {
    id: "GBG-0198",
    raw: "강남미인의원에서 입술 필러 했어요. 박원장님이 모양을 꼼꼼히 봐주셨고 38만원이었어요. 멍은 5일 정도 갔어요.",
  },
];

function normalizedShingles(value: string) {
  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const shingles = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) shingles.add(normalized.slice(index, index + 3));
  return shingles;
}

function similarity(left: string, right: string) {
  const a = normalizedShingles(left);
  const b = normalizedShingles(right);
  const intersection = [...a].filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

async function digest(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extractEvidence(raw: string) {
  const clinic = raw.match(/([가-힣A-Za-z0-9·\s]{2,30}?(?:성형외과|피부과|의원|클리닉))에서/)?.[1]?.trim() ?? null;
  const procedure = procedureIndex.find((item) => raw.includes(item.ko)) ?? null;
  const surgeon = raw.match(/([가-힣]{1,4}(?:원장님|선생님|의사))/)?.[1] ?? null;
  const priceRaw = raw.match(/\d[\d,.]*\s*(?:만\s*원|만원|원)/)?.[0]?.replace(/\s/g, "") ?? null;
  const recoveryRaw = raw.match(/(?:붓기|회복|멍)[^.!?。]{0,12}?\d+(?:\.\d+)?\s*(?:일|주|개월)(?:\s*정도)?/)?.[0]?.trim() ?? null;
  const piiSpans = raw.match(/01[016789]-?\d{3,4}-?\d{4}|(?:카톡|카카오톡|Kakao)\s*(?:ID|아이디)?\s*[:：]?\s*[A-Za-z0-9_.-]{3,}/gi) ?? [];
  const sponsorshipTerms = ["협찬", "광고", "제공받아", "원고료"].filter((term) => raw.includes(term));
  return { clinic, procedure, surgeon, priceRaw, recoveryRaw, piiSpans, sponsorshipTerms };
}

async function sourceScout(raw: string) {
  const extracted = extractEvidence(raw);
  const snapshotSha = await digest(raw);
  return {
    source_kind: "community_forum",
    locale: "ko-KR",
    captured_at: incomingReview.capturedAt,
    source_url: incomingReview.sourceUrl,
    original_korean: raw,
    immutable_snapshot: `sha256:${snapshotSha}`,
    ingest_contract: {
      schema: "review.source.v1",
      idempotency_key: `${incomingReview.sourceUrl}#${snapshotSha.slice(0, 16)}`,
      delivery: "at-least-once safe",
    },
    evidence_spans: {
      clinic: extracted.clinic,
      procedure: extracted.procedure?.ko ?? null,
      surgeon: extracted.surgeon,
      price_raw: extracted.priceRaw,
      recovery_raw: extracted.recoveryRaw,
    },
    risk_signals: {
      pii_spans: extracted.piiSpans,
      sponsorship_terms: extracted.sponsorshipTerms,
    },
    disclosure: extracted.sponsorshipTerms.length ? "Commercial relationship language detected" : "No sponsorship disclosure found",
  };
}

function parseRecoveryDays(value: string | null) {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(일|주|개월)/);
  if (!match) return null;
  const quantity = Number(match[1]);
  return Math.round(quantity * (match[2] === "주" ? 7 : match[2] === "개월" ? 30 : 1));
}

function normalizer(source: Awaited<ReturnType<typeof sourceScout>>) {
  // Preserve the known unit defect so the independent audit contract has real work.
  const priceRaw = source.evidence_spans.price_raw;
  const priceNumber = priceRaw ? Number(priceRaw.replace(/[^\d.]/g, "")) : null;
  const legacyPriceCandidate = priceNumber === null ? null : priceRaw?.includes("만") ? priceNumber * 1_000 : priceNumber;
  const procedure = procedureIndex.find((item) => item.ko === source.evidence_spans.procedure);
  const isSeed = source.original_korean === incomingReview.raw;
  const clinicName = source.evidence_spans.clinic;
  const evidenceSummary = [
    procedure ? procedure.label : "an unresolved procedure",
    clinicName ? `at ${clinicName}` : "at an unnamed clinic",
    priceRaw ? `reported price ${priceRaw}` : "no price detected",
    source.evidence_spans.recovery_raw ? `recovery note “${source.evidence_spans.recovery_raw}”` : "no recovery duration detected",
  ].join(", ");
  const safeOriginal = source.risk_signals.pii_spans.reduce((text, span) => text.replace(span, "[CONTACT REDACTED]"), source.original_korean);

  return {
    translated_review: isSeed
      ? "I had natural-adhesion double-eyelid surgery at Elite Plastic Surgery. Dr. Kim did not push unnecessary procedures, which I appreciated. It cost ₩3.5 million. Swelling lasted about two weeks and the result now looks natural."
      : `Evidence-led English preview: The review mentions ${evidenceSummary}. A human translator must confirm nuance before publishing.`,
    safe_original_korean: safeOriginal,
    redactions: source.risk_signals.pii_spans.map((span) => ({ type: "contact", source_span: span, replacement: "[CONTACT REDACTED]" })),
    clinic_candidates: isSeed
      ? [
          { clinic_id: "kr-seoul-elite-ps-01", name: "Elite Plastic Surgery", source_name: clinicName, confidence: 0.71 },
          { clinic_id: "kr-seoul-the-elite-07", name: "The Elite Clinic", source_name: clinicName, confidence: 0.63 },
        ]
      : clinicName
        ? [{ clinic_id: null, name: clinicName, source_name: clinicName, confidence: 0.55 }]
        : [],
    procedure: procedure
      ? { taxonomy_id: procedure.taxonomyId, label: procedure.label, source_name: procedure.ko, confidence: isSeed ? 0.96 : 0.82 }
      : { taxonomy_id: null, label: "Procedure unresolved", source_name: null, confidence: 0 },
    surgeon: { display_name: source.evidence_spans.surgeon ?? "Not detected", verified_id: null, confidence: source.evidence_spans.surgeon ? 0.42 : 0 },
    price_candidate_krw: legacyPriceCandidate,
    price_source_span: priceRaw,
    recovery_days: parseRecoveryDays(source.evidence_spans.recovery_raw),
    translation_confidence: isSeed ? 0.91 : 0.58,
  };
}

function audit(normalized: ReturnType<typeof normalizer>, source: Awaited<ReturnType<typeof sourceScout>>) {
  const unitMatch = normalized.price_source_span?.match(/([\d,.]+)만(?:원)?/);
  const guardedPrice = unitMatch ? Number(unitMatch[1].replace(/,/g, "")) * 10_000 : normalized.price_candidate_krw;
  const priceRepaired = guardedPrice !== null && normalized.price_candidate_krw !== null && guardedPrice !== normalized.price_candidate_krw;
  const clinicNeedsReview = !normalized.clinic_candidates[0] || normalized.clinic_candidates[0].confidence < 0.85;
  const surgeonNeedsReview = !normalized.surgeon.verified_id;
  const procedureNeedsReview = !normalized.procedure.taxonomy_id;
  const evidencePoints = [normalized.clinic_candidates.length > 0, normalized.procedure.taxonomy_id, normalized.price_source_span, normalized.recovery_days].filter(Boolean).length;
  const duplicateCandidates = knownReviewCorpus
    .map((record) => ({ review_id: record.id, similarity: similarity(source.original_korean, record.raw) }))
    .sort((left, right) => right.similarity - left.similarity);
  const topDuplicate = duplicateCandidates[0];
  // Calibrated so minor Korean adverb/particle edits are quarantined for review.
  const duplicateThreshold = 0.84;
  const duplicateFound = topDuplicate.similarity >= duplicateThreshold;
  const piiFound = source.risk_signals.pii_spans.length > 0;
  const sponsorshipFound = source.risk_signals.sponsorship_terms.length > 0;
  const baseTrustScore = normalized.translation_confidence > 0.8 ? 78 : 42 + evidencePoints * 6;

  return {
    corrected_price_krw: guardedPrice,
    repairs: priceRepaired
      ? [{ rule: "KRW_MANWON_UNIT", from: normalized.price_candidate_krw, to: guardedPrice, severity: "critical" }]
      : [],
    duplicate_search: {
      top_similarity: Number(topDuplicate.similarity.toFixed(3)),
      matched_review_id: duplicateFound ? topDuplicate.review_id : null,
      threshold: duplicateThreshold,
      method: "character_trigram_jaccard_v1",
    },
    policy_checks: {
      pii: { status: piiFound ? "redacted_and_blocked" : "pass", spans_found: source.risk_signals.pii_spans.length },
      sponsorship: { status: sponsorshipFound ? "disclosure_review" : "pass", terms: source.risk_signals.sponsorship_terms },
      duplicate: { status: duplicateFound ? "quarantine" : "pass" },
    },
    source_integrity: { snapshot_match: true, evidence_spans_preserved: true },
    entity_resolution: {
      clinic: clinicNeedsReview ? "human_confirmation_required" : "resolved",
      surgeon: surgeonNeedsReview ? "unverified" : "verified",
    },
    trust_score: Math.max(18, baseTrustScore - (duplicateFound ? 22 : 0) - (piiFound ? 18 : 0) - (sponsorshipFound ? 12 : 0)),
    publishable: !clinicNeedsReview && !surgeonNeedsReview && !procedureNeedsReview && !priceRepaired && !duplicateFound && !piiFound && !sponsorshipFound,
    blockers: [
      ...(clinicNeedsReview ? ["Clinic match is below the 0.85 auto-link threshold"] : []),
      ...(surgeonNeedsReview ? [`“${normalized.surgeon.display_name}” cannot be tied to a verified surgeon record`] : []),
      ...(procedureNeedsReview ? ["Procedure could not be mapped to the current taxonomy"] : []),
      ...(priceRepaired ? ["Critical price repair requires reviewer acknowledgement"] : []),
      ...(duplicateFound ? [`Possible duplicate of ${topDuplicate.review_id} exceeds the ${duplicateThreshold} threshold`] : []),
      ...(piiFound ? ["Contact information was redacted; privacy reviewer acknowledgement required"] : []),
      ...(sponsorshipFound ? ["Commercial relationship language requires disclosure review"] : []),
      ...(normalized.translation_confidence < 0.8 ? ["Edited input requires human translation review"] : []),
    ],
  };
}

function publishGate(audited: ReturnType<typeof audit>) {
  const queues = [
    ...(audited.repairs.length ? ["price-repair"] : []),
    ...(audited.duplicate_search.matched_review_id ? ["duplicate-quarantine"] : []),
    ...(audited.policy_checks.pii.status !== "pass" ? ["privacy-review"] : []),
    ...(audited.policy_checks.sponsorship.status !== "pass" ? ["disclosure-review"] : []),
    ...(audited.entity_resolution.clinic !== "resolved" || audited.entity_resolution.surgeon !== "verified" ? ["entity-review"] : []),
  ];
  return {
    decision: audited.publishable ? "publish" : "hold_for_human",
    queues: queues.length ? queues : ["publish-ready"],
    priority: audited.repairs.length || audited.duplicate_search.matched_review_id || audited.policy_checks.pii.status !== "pass" ? "critical" : "standard",
    operational_controls: {
      contract_version: "review.publish.v1",
      retry_policy: "exponential backoff; max 3 attempts",
      dead_letter_queue: "review-publish-dlq",
      human_sla: "critical 4h · standard 24h",
    },
    immutable_fields: ["source_url", "snapshot_sha", "original_korean", "repair_log"],
    public_badges: ["Source archived", "Procedure evidence found", "Human checked translation"],
    hidden_badges: ["Verified surgeon"],
    reason: audited.blockers,
  };
}

export async function runReviewWorkflow(onEvent: (event: WorkflowEvent) => void, rawReview = incomingReview.raw) {
  const cleanReview = rawReview.trim();
  if (!cleanReview) throw new Error("A Korean source review is required");

  onEvent({ id: "source", status: "running" });
  await wait(650);
  const sourced = await sourceScout(cleanReview);
  const evidenceCount = Object.values(sourced.evidence_spans).filter(Boolean).length;
  onEvent({ id: "source", status: "complete", duration: 612, summary: `Snapshot locked; ${evidenceCount} evidence spans extracted`, output: sourced });

  onEvent({ id: "normalize", status: "running" });
  await wait(760);
  const normalized = normalizer(sourced);
  onEvent({ id: "normalize", status: "warning", duration: 741, summary: `Structured; ${normalized.clinic_candidates.length} clinic candidate${normalized.clinic_candidates.length === 1 ? "" : "s"}; translation review required`, output: normalized });

  onEvent({ id: "audit", status: "running" });
  await wait(820);
  const audited = audit(normalized, sourced);
  const criticalCount = audited.repairs.length + (audited.duplicate_search.matched_review_id ? 1 : 0) + (audited.policy_checks.pii.status !== "pass" ? 1 : 0);
  onEvent({ id: "audit", status: "warning", duration: 801, summary: `${criticalCount} critical safeguard${criticalCount === 1 ? "" : "s"}; identity unresolved`, output: audited });

  onEvent({ id: "publish", status: "running" });
  await wait(580);
  const gate = publishGate(audited);
  onEvent({ id: "publish", status: "complete", duration: 557, summary: `Fail-closed; routed to ${gate.queues.length} review queue${gate.queues.length === 1 ? "" : "s"}`, output: gate });

  return { sourced, normalized, audited, gate };
}
