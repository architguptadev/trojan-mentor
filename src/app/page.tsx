import Link from "next/link";

export default function Landing() {
  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Trojan Mentor · The Trojan Network, activated</p>
          <h1 id="hero-title">
            Your next chapter starts with a <em>conversation.</em>
          </h1>
          <p className="lede">
            Trojan Mentor pairs students with alumni who have chosen to mentor — matched on where you’re headed, what they
            know, and the communities you share. Then it helps one introduction become a relationship that keeps moving.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link className="btn" href="/demo">
              Start the guided demo
            </Link>
            <Link className="btn btn-secondary" href="/how-it-works">
              How matching works
            </Link>
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            No sign-in. A fictional cohort is ready to explore, and everything stays in your browser.
          </p>
        </div>
        <aside className="hero-aside" aria-label="Why this exists">
          <p className="quote">
            “The alumni network is there. What students lack is a reason to reach out, the right person to reach, and a plan
            for what happens after hello.”
          </p>
          <p className="small muted">The problem Trojan Mentor is designed around — an intended benefit we’d validate with students and alumni before claiming impact.</p>
        </aside>
      </section>

      <section className="section" aria-labelledby="journey-title">
        <div className="row-between" style={{ marginBottom: 24 }}>
          <h2 id="journey-title">From profile to progress</h2>
          <p className="muted small" style={{ margin: 0 }}>Every step is working in the demo.</p>
        </div>
        <ol className="journey">
          <li>
            <h3>Share where you’re headed</h3>
            <p>Upload a resume or start from a sample. Extracted fields are only a draft until you review them.</p>
          </li>
          <li>
            <h3>Alumni opt in</h3>
            <p>Mentors set their own capacity and visibility, and can pause at any time.</p>
          </li>
          <li>
            <h3>The cohort is allocated</h3>
            <p>A global optimizer maximizes total fit across everyone, within each mentor’s capacity.</p>
          </li>
          <li>
            <h3>Both sides say yes</h3>
            <p>Nothing happens until the student and the mentor each approve the match.</p>
          </li>
          <li>
            <h3>An introduction you approve</h3>
            <p>Every outgoing message is drafted, shown in full, and sent only after explicit approval.</p>
          </li>
          <li>
            <h3>A first meeting</h3>
            <p>Find an overlapping time and approve the invitation. Retries never send twice.</p>
          </li>
          <li>
            <h3>Milestones that matter</h3>
            <p>Preparation and next steps are drawn from the student’s own reviewed goals.</p>
          </li>
          <li>
            <h3>A cohort you can see</h3>
            <p>Coverage, capacity and progress, calculated from the program’s actual state.</p>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="layers-title">
        <p className="eyebrow">Honest by design</p>
        <h2 id="layers-title" style={{ marginBottom: 12 }}>Four different kinds of work, labelled as what they are</h2>
        <p className="lede" style={{ marginBottom: 28 }}>
          We don’t call everything “AI.” Each layer is shown separately in the product so students and staff know what
          produced a result.
        </p>
        <div className="layers">
          <div>
            <span className="tag tag-neutral">Interpretation</span>
            <h3>Reading documents</h3>
            <p>Gemini reads a resume into editable fields when configured and consented to. Otherwise a rule-based demo parser runs — clearly labelled “not AI.”</p>
          </div>
          <div>
            <span className="tag tag-neutral">Scoring</span>
            <h3>Compatibility</h3>
            <p>A transparent heuristic: overlapping career direction, expertise, school, communities and availability. Every point is explained.</p>
          </div>
          <div>
            <span className="tag tag-neutral">Allocation</span>
            <h3>The cohort</h3>
            <p>Deterministic minimum-cost flow finds the highest total fit. Students below the threshold stay unmatched rather than get a weak match.</p>
          </div>
          <div>
            <span className="tag tag-neutral">Coordination</span>
            <h3>Next steps</h3>
            <p>Plan, approve, act, observe. Introductions and invites run through simulated adapters with full history and safe retries.</p>
          </div>
        </div>
      </section>

      <section className="section grid-2" aria-labelledby="consent-title">
        <div>
          <p className="eyebrow">Consent first</p>
          <h2 id="consent-title">Three separate choices, all reversible</h2>
        </div>
        <div className="stack">
          <p>
            Storing your reviewed profile, sending a document to an external AI service, and being visible for matching are
            three separate decisions. Withdrawing any of them takes effect immediately: open matches are revoked and
            pending messages are cancelled, so an old approval can never authorize something new.
          </p>
          <p className="muted">Raw resumes are never stored. Only the fields you review and save are kept, and in this demo they live in your browser only.</p>
          <p>
            <Link href="/privacy">Read how data is handled →</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
