import Link from "next/link";
import { SCORE_WEIGHTS } from "@/domain/compatibility";
import { DEFAULT_THRESHOLD } from "@/domain/cohort";

export const metadata = { title: "How matching works" };

export default function HowItWorks() {
  const W = SCORE_WEIGHTS;
  return (
    <div className="page">
      <header className="page-head">
        
        <h1>What does the work, and how much to trust it</h1>
        <p className="lede">Four separate pieces, each labeled in the product for what it is. Only the first one uses AI.</p>
      </header>

      <section className="section" style={{ paddingTop: 0 }} aria-labelledby="l1">
        <div className="grid-2">
          <div>
            <p className="tag tag-sim" style={{ marginBottom: 10 }}>Uses AI, only with permission</p>
            <h2 id="l1">Reading a resume into fields</h2>
          </div>
          <div className="stack">
            <p>When a deployment has a Gemini API key and the student has consented to external AI processing, the server sends the document to Gemini with a fixed JSON schema and an instruction to treat the document as untrusted data. The response is validated, sanitized and bounded before the student sees it.</p>
            <p>Without credentials or consent, a <strong>simple rule-based reader (not AI)</strong> reads labelled lines (“Skills: …”) and matches a keyword list. Either way, the output is only a draft: the student must review and confirm every field before anything is saved or used.</p>
            <p className="small muted">Handled failure modes: oversized or unsupported files, fake or damaged PDFs, invalid text encoding, scanned documents without text, model timeouts, quota and auth errors, non-JSON or off-schema output, and instruction-like text inside documents.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="l2">
        <div className="grid-2">
          <div>
            <p className="tag tag-neutral" style={{ marginBottom: 10 }}>No AI: a points system</p>
            <h2 id="l2">A fit score you can read</h2>
            <p className="muted" style={{ marginTop: 12 }}>Points from 0 to 100. A rough guide to fit, not a prediction of how the mentorship will go.</p>
          </div>
          <div>
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Signal</th><th scope="col">Compares</th><th scope="col">Points</th></tr></thead>
                <tbody>
                  <tr><td>Career direction</td><td className="small">Student target roles, industries and goal text vs. mentor roles and industries</td><td className="num small">{W.careerDirection.per} per shared concept, max {W.careerDirection.max}</td></tr>
                  <tr><td>Relevant expertise</td><td className="small">Student skills and interests vs. mentor expertise</td><td className="num small">{W.expertise.per} each, max {W.expertise.max}</td></tr>
                  <tr><td>Shared USC school</td><td className="small">Same school</td><td className="num small">{W.school.max}</td></tr>
                  <tr><td>Shared community</td><td className="small">Communities both chose to list</td><td className="num small">{W.communities.per} each, max {W.communities.max}</td></tr>
                  <tr><td>Availability</td><td className="small">Overlapping weekly time slots</td><td className="num small">{W.availability.one} for one, {W.availability.max} for two or more</td></tr>
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>Terms are normalized through a small, hand-written synonym list (so “APM” and “product manager” count as the same thing). Unknown terms only match exactly.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="l3">
        <div className="grid-2">
          <div>
            <p className="tag tag-neutral" style={{ marginBottom: 10 }}>No AI: an optimizer</p>
            <h2 id="l3">Optimizing the whole cohort</h2>
          </div>
          <div className="stack">
            <p>Independent “top match” lists let the first student claim the best mentor, even when that strands someone else. Instead, the allocator solves a <strong>minimum-cost flow</strong> problem: source → student (capacity 1) → mentor (cost = −score) → sink (capacity = mentor’s seats). It augments along the cheapest path until no path improves the total, which yields the maximum total compatibility.</p>
            <p>Only eligible pairs get an edge: both have consented to processing and matching, the mentor has opted in and is visible, neither has excluded the other, the pair hasn’t been declined, and the score is at least <strong>{DEFAULT_THRESHOLD}</strong>. Students without a profitable path stay unmatched, with a reason computed from the data.</p>
            <p className="small muted">Verified in tests against brute-force enumeration on 300 random small cohorts, plus a constructed case where greedy matching produces a lower total. Approved matches are kept fixed on re-runs.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="l4">
        <div className="grid-2">
          <div>
            <p className="tag tag-neutral" style={{ marginBottom: 10 }}>No AI: people approve each step</p>
            <h2 id="l4">Plan, approve, act, observe</h2>
          </div>
          <div className="stack">
            <p>A match proceeds only when both the student and the mentor approve it. That unlocks a <em>draft</em> introduction — it does not send anything. Every outgoing message or calendar operation is stored with its exact content, required approver, approval fingerprint, attempt count, timestamped history and a stable idempotency key.</p>
            <p>Editing a draft clears its approval. Any consent change bumps a version number that approvals record, so stale approvals can’t authorize new actions. Email and calendar delivery are <strong>simulated adapters</strong>; a demo control lets you force a provider error or a lost acknowledgement to watch retries complete without duplicates.</p>
            <p>First-meeting preparation and milestones are <strong>template-based</strong>, filled from the student’s reviewed goals and the mentor’s background. They are not AI-generated.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="limits">
        <div className="grid-2">
          <div>
            
            <h2 id="limits">What this prototype is not</h2>
          </div>
          <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Not connected to any USC system, PeopleGrove, or alumni database. Every person is fictional.</li>
            <li>No real authentication: simulated roles are a demo convenience.</li>
            <li>No real email or calendar delivery.</li>
            <li>State lives in one browser’s localStorage; a Postgres schema is provided for a server deployment but not wired up.</li>
            <li>The scoring weights are hand-chosen, not learned or validated against outcomes. Impact on students is an intended benefit, not a measured one.</li>
          </ul>
        </div>
        <p style={{ marginTop: 32 }}><Link className="btn" href="/home">Open the platform</Link></p>
      </section>
    </div>
  );
}
