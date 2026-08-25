"use client";

import { useMemo, useState } from "react";
import { incomingReview, reviewExamples, runReviewWorkflow, type StepId, type WorkflowEvent } from "../lib/review-workflow";

const stepMeta: Array<{ id: StepId; number: string; name: string; detail: string; tool: string }> = [
  { id: "source", number: "01", name: "Source Scout", detail: "Capture source + Korean evidence", tool: "fetch · snapshot · spans" },
  { id: "normalize", number: "02", name: "Normalizer", detail: "Translate + resolve entities", tool: "translator · entity index" },
  { id: "audit", number: "03", name: "Trust Auditor", detail: "Validate claims + duplicates", tool: "rules · similarity search" },
  { id: "publish", number: "04", name: "Publish Gate", detail: "Policy + human checkpoint", tool: "policy engine · queue" },
];

const makeInitialEvents = () => Object.fromEntries(stepMeta.map((step) => [step.id, { id: step.id, status: "waiting" }])) as Record<StepId, WorkflowEvent>;
type WorkflowResult = Awaited<ReturnType<typeof runReviewWorkflow>>;

export default function ReviewWorkflow() {
  const [events, setEvents] = useState<Record<StepId, WorkflowEvent>>(makeInitialEvents);
  const [reviewText, setReviewText] = useState(incomingReview.raw);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<StepId>("source");
  const [finished, setFinished] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const completed = useMemo(() => Object.values(events).filter((event) => event.status === "complete" || event.status === "warning").length, [events]);

  async function run() {
    if (running) return;
    setRunning(true);
    setFinished(false);
    setApproved(false);
    setResult(null);
    setEvents(makeInitialEvents());
    setSelected("source");
    const workflowResult = await runReviewWorkflow((event) => {
      setSelected(event.id);
      setEvents((current) => ({ ...current, [event.id]: event }));
    }, reviewText);
    setResult(workflowResult);
    setFinished(true);
    setRunning(false);
    setSelected("publish");
  }

  function editReview(value: string) {
    setReviewText(value);
    setFinished(false);
    setApproved(false);
    setResult(null);
    setEvents(makeInitialEvents());
    setSelected("source");
  }

  function reset() {
    editReview(incomingReview.raw);
    setShowOriginal(false);
  }

  function inspect(step: StepId) {
    setSelected(step);
    const target = step === "source" ? document.getElementById("korean-review") : document.getElementById("handoff-inspector");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (step === "source") window.setTimeout(() => (target as HTMLTextAreaElement | null)?.focus(), 250);
  }

  const activeEvent = events[selected];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gangnam Beauty Guide home"><span>gangnam beauty guide<b>.</b></span></a>
        <nav className="main-nav" aria-label="Workflow navigation">
          <button className={selected === "source" ? "active" : ""} type="button" onClick={() => inspect("source")} aria-pressed={selected === "source"}>Edit review</button>
          <button className={selected === "normalize" ? "active" : ""} type="button" onClick={() => inspect("normalize")} aria-pressed={selected === "normalize"}>Normalize</button>
          <button className={selected === "audit" ? "active" : ""} type="button" onClick={() => inspect("audit")} aria-pressed={selected === "audit"}>Trust audit</button>
          <button className={selected === "publish" ? "active" : ""} type="button" onClick={() => inspect("publish")} aria-pressed={selected === "publish"}>Publish gate</button>
        </nav>
        <div className="header-actions"><span className="live-dot" />Agent Lab <button type="button" onClick={reset}>Reset</button></div>
      </header>

      <section className="workspace" id="top">
        <aside className="source-panel">
          <h1>TRUST IS A CHAIN OF EVIDENCE.</h1>
          <p className="intro">Translate Korean reviews without laundering uncertainty. Each agent hands typed evidence—not prose—to the next.</p>

          <div className="source-card">
            <div className="source-meta">
              <span className="source-logo">N</span><div><strong>Naver Café</strong><small>여우야 · captured 4 days ago</small></div><span className="ko-pill">KO</span>
            </div>
            <div className="source-visual">
              <div className="source-image" role="img" aria-label="Rain-lit Gangnam clinic street with archived review papers behind glass" />
              <span>Archived context · Gangnam, Seoul</span>
            </div>
            <div className="example-switcher" aria-label="Korean review examples">
              {reviewExamples.map((example) => <button className={reviewText === example.raw ? "active" : ""} type="button" key={example.label} onClick={() => editReview(example.raw)} disabled={running}>{example.label}</button>)}
            </div>
            <div className="review-edit-bar"><label htmlFor="korean-review">Editable Korean source</label><span>{reviewText.length} characters</span></div>
            <textarea id="korean-review" lang="ko" value={reviewText} onChange={(event) => editReview(event.target.value)} disabled={running} spellCheck={false} aria-describedby="review-edit-note" />
            <div className="source-foot"><span>↗ Local source fixture</span><span>{result ? String(result.sourced.immutable_snapshot).slice(0, 18) + "…" : "New snapshot on run"}</span></div>
          </div>

          <button className="run-button" type="button" onClick={run} disabled={running || !reviewText.trim()}>
            <span>{running ? `Running agent ${Math.min(completed + 1, 4)} of 4…` : finished ? "Replay workflow" : "Run 4-step workflow"}</span><b>{running ? "•••" : "→"}</b>
          </button>
          <p className="run-note" id="review-edit-note">Choose an example or paste Korean · no auto-publish</p>

          <div className="principles"><span>Source-bound</span><span>Repair-logged</span><span>Human-gated</span></div>
        </aside>

        <section className="pipeline-panel" id="workflow" aria-label="Review processing workflow">
          <div className="pipeline-heading">
            <div><span className="eyebrow">Live workflow trace</span><h2>Evidence before eloquence</h2></div>
            <span className={`status-pill ${finished ? "held" : running ? "running" : ""}`}>{finished ? "Held · needs review" : running ? "Agents working" : "Ready to run"}</span>
          </div>

          <div className="step-list">
            {stepMeta.map((step) => {
              const event = events[step.id];
              return (
                <button className={`step ${selected === step.id ? "active" : ""} ${event.status}`} key={step.id} onClick={() => setSelected(step.id)} type="button">
                  <div className="step-number">{event.status === "complete" ? "✓" : event.status === "warning" ? "!" : step.number}</div>
                  <div className="step-copy"><strong>{step.name}</strong><span>{event.summary || step.detail}</span></div>
                  <div className="step-tool">{step.tool}</div>
                  <div className="step-state">{event.status === "running" ? <i className="spinner" /> : event.duration ? `${event.duration} ms` : event.status}</div>
                </button>
              );
            })}
          </div>

          <div className="detail-grid">
            <section className="trace-card" id="handoff-inspector">
              <div className="card-heading"><div><span className="eyebrow">Selected handoff</span><h3>{stepMeta.find((step) => step.id === selected)?.name}</h3></div><span className={`contract-state ${activeEvent.status}`}>{activeEvent.status}</span></div>
              {activeEvent.output ? (
                <pre>{JSON.stringify(activeEvent.output, null, 2)}</pre>
              ) : (
                <div className="empty-trace"><span>{selected === "source" ? "{ }" : "←"}</span><p>{running ? "Waiting for the previous contract…" : "Run the workflow, then inspect every agent handoff here."}</p></div>
              )}
            </section>

            <section className={`result-card ${finished ? "visible" : ""}`}>
              {!finished ? (
                <div className="result-placeholder"><span className="passport-seal">GBG</span><h3>Public review passport</h3><p>The final card will inherit evidence and uncertainty from every prior step.</p><div className="progress-line"><i style={{ width: `${completed * 25}%` }} /></div></div>
              ) : (
                <>
                  <div className="result-top"><span className="hold-badge">Human review required</span><span className="score">{result?.audited.trust_score ?? 0}<small>/100 trust</small></span></div>
                  <div className="review-title"><div><span>Likely clinic</span><h3>{result?.normalized.clinic_candidates[0]?.name ?? "Clinic unresolved"} <b>?</b></h3></div><span className="procedure-chip">{result?.normalized.procedure.label ?? "Procedure unresolved"}</span></div>
                  <p className="translated">{showOriginal ? result?.sourced.original_korean : result?.normalized.translated_review}</p>
                  <button className="language-toggle" type="button" onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? "Read English translation" : "See original Korean"}</button>
                  {result?.audited.repairs.length ? <div className="repair-alert"><span>!</span><div><strong>Validator caught a price-unit error</strong><small>₩{Number(result.normalized.price_candidate_krw).toLocaleString()} → ₩{Number(result.audited.corrected_price_krw).toLocaleString()} · raw span “{result.normalized.price_source_span}” preserved</small></div></div> : <div className="validation-note"><b>✓</b><span>Price validator passed · {result?.normalized.price_source_span ?? "no price span detected"}</span></div>}
                  <div className="trust-facts"><span><b>✓</b> Source fingerprinted</span><span className={result?.normalized.procedure.taxonomy_id ? "" : "muted"}><b>{result?.normalized.procedure.taxonomy_id ? "✓" : "?"}</b> Procedure {result?.normalized.procedure.taxonomy_id ? "evidenced" : "unresolved"}</span><span className="muted"><b>?</b> Surgeon unverified</span></div>
                  <div className="review-actions">
                    <button type="button" className={approved ? "approved" : "approve"} onClick={() => setApproved(true)}>{approved ? "✓ Reviewer approval recorded" : "Simulate reviewer approval"}</button>
                    <span>{approved ? "Ready for publish queue" : "Auto-publish blocked"}</span>
                  </div>
                </>
              )}
            </section>
          </div>

          <footer className="pipeline-footer"><span>4 agent contracts</span><span>3 deterministic validators</span><span>1 human checkpoint</span><span>0 silent repairs</span></footer>
        </section>
      </section>
    </main>
  );
}
