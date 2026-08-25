import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review Passport — Gangnam Beauty Guide",
  description:
    "A provenance-first workflow for translating, normalizing, and verifying Korean clinic reviews.",
};

const steps = [
  ["01", "Source Scout", "Capture source + Korean evidence"],
  ["02", "Normalizer", "Translate + resolve entities"],
  ["03", "Trust Auditor", "Validate claims + duplicates"],
  ["04", "Publish Gate", "Human-approved release"],
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gangnam Beauty Guide home">
          <span className="brand-mark">G</span>
          <span>Gangnam Beauty Guide</span>
        </a>
        <div className="lab-title"><span>Agent Lab</span><i />Review Passport</div>
        <div className="header-actions"><span className="live-dot" />Offline-safe demo <button type="button">Run history</button></div>
      </header>

      <section className="workspace" id="top">
        <aside className="source-panel">
          <div className="eyebrow">Incoming review · #GBG-0241</div>
          <h1>Turn local stories into trustworthy guidance.</h1>
          <p className="intro">A transparent agent chain for review syndication—not a black-box translation prompt.</p>

          <div className="source-card">
            <div className="source-meta">
              <span className="source-logo">N</span>
              <div><strong>Naver Café</strong><small>여우야 · 4 days ago</small></div>
              <span className="ko-pill">KO</span>
            </div>
            <blockquote>“엘리트성형외과에서 자연유착 쌍꺼풀 했어요. 상담해주신 김원장님이 과하게 권하지 않아서 좋았고 350만원 들었어요...”</blockquote>
            <div className="source-foot"><span>↗ Source snapshot</span><span>SHA 8da3…f91</span></div>
          </div>

          <button className="run-button" type="button"><span>Run 4-step workflow</span><b>→</b></button>
          <p className="run-note">Replayable · deterministic fallbacks · no auto-publish</p>
        </aside>

        <section className="pipeline-panel" aria-label="Review processing workflow">
          <div className="pipeline-heading"><div><span className="eyebrow">Workflow trace</span><h2>Evidence before eloquence</h2></div><span className="status-pill">Ready to run</span></div>
          <div className="step-list">
            {steps.map(([number, name, detail], index) => (
              <article className={`step ${index === 0 ? "active" : ""}`} key={number}>
                <div className="step-number">{number}</div>
                <div className="step-copy"><strong>{name}</strong><span>{detail}</span></div>
                <div className="step-tool">{index === 0 ? "fetch · snapshot" : index === 1 ? "translate · entity DB" : index === 2 ? "rules · similarity" : "policy gate"}</div>
                <div className="step-state">{index === 0 ? "Queued" : "Waiting"}</div>
              </article>
            ))}
          </div>

          <div className="handoff-card">
            <div><span className="eyebrow">Contract preview</span><h3>Every handoff is inspectable</h3><p>Typed JSON moves between agents. Validators can stop the chain before a polished translation hides a bad fact.</p></div>
            <pre>{`source.price_raw  →  "350만원"\nnormalizer.krw     →  awaiting run\nauditor.decision   →  blocked by default`}</pre>
          </div>
        </section>
      </section>
    </main>
  );
}
