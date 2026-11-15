import Link from "next/link";
import { createSeedState } from "@/domain/seed";
import { compatibility } from "@/domain/compatibility";
import { Avatar } from "@/components/People";

export default function Landing() {
  const seed = createSeedState("2026-11-14T08:00:00.000Z");
  const s = seed.students.find((x) => x.id === "s-maya")!;
  const m = seed.mentors.find((x) => x.id === "m-daniel")!;
  const c = compatibility(s, m);
  const reasons = c.components.filter((x) => x.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);

  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">Your next chapter starts with a conversation.</h1>
          <p className="lede">
            Trojan Mentor introduces you to an alum who has already said yes to mentoring, chosen for where you’re headed. Then it
            helps the two of you keep going.
          </p>
          <div className="actions" style={{ marginTop: 28 }}>
            <Link className="btn" href="/onboard/student">I’m a student</Link>
            <Link className="btn btn-secondary" href="/onboard/alumni">I’m an alum</Link>
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            Running a program? <Link href="/home">Open the coordinator view</Link>.
          </p>
        </div>

        <figure className="example" style={{ margin: 0 }} aria-label={`Example match: ${s.name} and ${m.name}`}>
          <span className="kicker">An example match</span>
          <div className="pair">
            <Avatar id={s.id} name={s.name} size={32} />
            <span className="person-name">{s.name}</span>
            <span className="and" aria-hidden="true">and</span>
            <Avatar id={m.id} name={m.name} size={32} />
            <span className="person-name">{m.name}</span>
            <span className="fit"><strong>{c.score}</strong> / 100 fit</span>
          </div>
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r.key}>
                <span className="pts num">+{r.points}</span>
                <span>{r.reason}</span>
              </li>
            ))}
          </ul>
          <figcaption className="tiny muted" style={{ marginTop: 12 }}>From the demo cohort. Everyone in it is fictional.</figcaption>
        </figure>
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title" style={{ marginBottom: 16 }}>How it works</h2>
        <ol className="steps-list">
          <li><h3>Share where you’re headed</h3><p>Start from your resume. You check every detail before anything is saved.</p></li>
          <li><h3>The whole cohort is matched</h3><p>Everyone is placed at once, so one student’s top pick never strands another.</p></li>
          <li><h3>You both say yes</h3><p>An introduction only happens when you and the alum each approve.</p></li>
          <li><h3>Meet, then keep going</h3><p>Pick a time you’re both free, then work through next steps built from your goals.</p></li>
        </ol>
      </section>

      <section className="section split" aria-labelledby="trust-title" style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
        <h2 id="trust-title">No cold messages. No surprises.</h2>
        <dl className="facts" style={{ gridTemplateColumns: "1fr" , gap: 14 }}>
          <div><dt style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.9375rem" }}>Nothing goes out without your approval.</dt><dd className="muted">You read the exact introduction or invitation first.</dd></div>
          <div><dt style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.9375rem" }}>If there’s no good match, we say so.</dt><dd className="muted">You won’t be paired with someone just to fill a slot.</dd></div>
          <div><dt style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.9375rem" }}>Alumni set their own limits.</dt><dd className="muted">They choose how many students to take and can pause at any time.</dd></div>
          <div><dt style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.9375rem" }}>You can change your mind.</dt><dd className="muted">Withdraw consent and anything waiting to be sent is cancelled.</dd></div>
        </dl>
      </section>
    </div>
  );
}
