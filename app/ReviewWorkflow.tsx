"use client";

import { useMemo, useState } from "react";
import { incomingReview, runReviewWorkflow, type StepId, type WorkflowEvent } from "../lib/review-workflow";

const stepMeta: Array<{ id: StepId; number: string; name: string; detail: string; tool: string }> = [
  { id: "source", number: "01", name: "Source Scout", detail: "Capture source + Korean evidence", tool: "fetch · snapshot · spans" },
  { id: "normalize", number: "02", name: "Normalizer", detail: "Translate + resolve entities", tool: "translator · entity index" },
  { id: "audit", number: "03", name: "Trust Auditor", detail: "Validate claims + duplicates", tool: "rules · similarity search" },
  { id: "publish", number: "04", name: "Publish Gate", detail: "Policy + human checkpoint", tool: "policy engine · queue" },
];

const initialEvents = Object.fromEntries(stepMeta.map((step) => [step.id, { id: step.id, status: "waiting" }])) as Record<StepId, WorkflowEvent>;

export default function ReviewWorkflow() {
  const [events, setEvents] = useState<Record<StepId, WorkflowEvent>>(initialEvents);
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
    setEvents(initialEvents);
    setSelected("source");
    await runReviewWorkflow((event) => {
      setSelected(event.id);
      setEvents((current) => ({ ...current, [event.id]: event }));
    });
    setFinished(true);
    setRunning(false);
    setSelected("publish");
  }

  const activeEvent = events[selected];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gangnam Beauty Guide home"><span>gangnam beauty guide<b>.</b></span></a>
        <nav className="main-nav" aria-label="Primary navigation"><a href="#workflow">Procedures</a><a href="#workflow">Find a clinic</a><a href="#workflow">Reviews</a><a href="#workflow">Safety</a></nav>
        <div className="header-actions"><span className="live-dot" />Agent Lab <button type="button" onClick={() => window.location.reload()}>Reset</button></div>
      </header>

      <section className="workspace" id="top">
        <aside className="source-panel">
          <div className="eyebrow">Review passport · #{incomingReview.id}</div>
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
            <blockquote>{incomingReview.raw}</blockquote>
            <div className="source-foot"><span>↗ Archived source</span><span>SHA {incomingReview.snapshotSha.slice(0, 4)}…{incomingReview.snapshotSha.slice(-3)}</span></div>
          </div>

          <button className="run-button" type="button" onClick={run} disabled={running}>
            <span>{running ? `Running agent ${Math.min(completed + 1, 4)} of 4…` : finished ? "Replay workflow" : "Run 4-step workflow"}</span><b>{running ? "•••" : "→"}</b>
          </button>
          <p className="run-note">No secrets · deterministic fixture · no auto-publish</p>

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
            <section className="trace-card">
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
                  <div className="result-top"><span className="hold-badge">Human review required</span><span className="score">78<small>/100 trust</small></span></div>
                  <div className="review-title"><div><span>Likely clinic</span><h3>Elite Plastic Surgery <b>?</b></h3></div><span className="procedure-chip">Double eyelid · natural adhesion</span></div>
                  <p className="translated">{showOriginal ? incomingReview.raw : "“I had natural-adhesion double-eyelid surgery at Elite Plastic Surgery. Dr. Kim did not push unnecessary procedures, which I appreciated. It cost ₩3.5 million. Swelling lasted about two weeks and the result now looks natural.”"}</p>
                  <button className="language-toggle" type="button" onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? "Read English translation" : "See original Korean"}</button>
                  <div className="repair-alert"><span>!</span><div><strong>Validator caught a 10× price error</strong><small>₩350,000 → ₩3,500,000 · raw span “350만원” preserved</small></div></div>
                  <div className="trust-facts"><span><b>✓</b> Source archived</span><span><b>✓</b> Procedure evidenced</span><span className="muted"><b>?</b> Surgeon unverified</span></div>
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
