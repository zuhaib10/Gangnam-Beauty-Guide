# Gangnam Review Passport

A thin, working vertical slice of Gangnam Beauty Guide's hardest product problem: turning Korean community reviews into reviewable English records without laundering away uncertainty.

## The workflow

1. **Source Scout** captures an immutable source snapshot and extracts Korean evidence spans.
2. **Normalizer** translates the review, maps the procedure taxonomy, proposes clinic/surgeon entities, and emits a price candidate.
3. **Trust Auditor** checks unit semantics, source integrity, duplicate similarity, and entity confidence. It repairs a seeded 10× `만원` price error and logs the repair.
4. **Publish Gate** applies policy. This example is held because the clinic match is below threshold, the surgeon is unresolved, and a critical repair needs acknowledgement.

Each step produces a typed JSON handoff visible in the UI. The hosted demonstration uses deterministic fixtures so evaluators can replay it without API keys; the contracts are deliberately model-neutral and can sit behind OpenAI, Anthropic, or a local Korean-language model.

## Why this shape

Translation quality is not the moat. Provenance, entity resolution, duplicate control, and honest verification states are. A fluent translation with the wrong clinic or price is more dangerous than an untranslated review, so deterministic validators outrank the generator and publishing is human-gated.

## Run locally

```bash
npm install
npm run dev
```

Validate with:

```bash
npm run lint
npm run build
node --experimental-strip-types --input-type=module -e "import {runReviewWorkflow} from './lib/review-workflow.ts'; const r=await runReviewWorkflow(()=>{}); console.log(r.audited.corrected_price_krw, r.gate.decision)"
```

Expected invariant: `3500000 hold_for_human`.
