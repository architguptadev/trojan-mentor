import Link from "next/link";
import { createSeedState } from "@/domain/seed";
import { compatibility } from "@/domain/compatibility";
import { Person, Thread, shortSchool } from "@/components/People";

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
            Trojan Mentor introduces you to an alum who has already said yes to mentoring, chosen for where you’re headed.
            Then it helps the two of you keep going.
          </p>
          <div className="row" style={{ marginTop: 30, gap: 12 }}>
            <Link className="btn" href="/onboard/student">I’m a student</Link>
            <Link className="btn btn-secondary" href="/onboard/alumni">I’m an alum</Link>
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            Running a program? <Link href="/home">Open the coordinator view</Link>. No sign-in needed; everyone already here is fictional.
          </p>
        </div>

        <figure className="hero-card" style={{ margin: 0 }} aria-label={`Example match: ${s.name} and ${m.name}`}>
          <Thread
            size={64}
            score={c.score}
            left={<Person id={s.id} name={s.name} meta={`${shortSchool(s.school)}, class of ${s.gradYear}`} size={64} />}
            right={<Person id={m.id} name={m.name} meta="Product lead in health tech" size={64} />}
          />
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r.key}>
                <span className="pts num">+{r.points}</span>
                <span>{r.reason}</span>
              </li>
            ))}
          </ul>
          <figcaption className="caption">A match from the demo cohort, with the reasons behind it.</figcaption>
        </figure>
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title" style={{ marginBottom: 28 }}>How it works</h2>
        <ol className="steps-list">
          <li>
            <h3>Share where you’re headed</h3>
            <p>Start from your resume. You check every detail before anything is saved.</p>
          </li>
          <li>
            <h3>We match the whole cohort</h3>
            <p>Everyone is placed at once, so one student’s top pick never strands another.</p>
          </li>
          <li>
            <h3>You both say yes</h3>
            <p>An introduction only happens when you and the alum each approve.</p>
          </li>
          <li>
            <h3>Meet, then keep going</h3>
            <p>Pick a time you’re both free, then work through next steps built from your goals.</p>
          </li>
        </ol>
      </section>

      <section className="section promise" aria-labelledby="trust-title">
        <h2 id="trust-title">No cold messages. No surprises.</h2>
        <ul>
          <li><strong>Nothing goes out without your approval.</strong> You read the exact introduction or invitation first.</li>
          <li><strong>If there’s no good match, we say so.</strong> You won’t be paired with someone just to fill a slot.</li>
          <li><strong>Alumni set their own limits.</strong> They choose how many students to take and can pause at any time.</li>
          <li><strong>You can change your mind.</strong> Withdraw consent and pending messages are cancelled right away.</li>
        </ul>
      </section>

      <section className="section card-sunk row-between" aria-label="Try the demo">
        <div>
          <h2 style={{ marginBottom: 6 }}>A cohort is already here</h2>
          <p className="muted" style={{ margin: 0 }}>Eight students and five alumni are waiting to be matched. Sign up yourself, or run matching as the coordinator.</p>
        </div>
        <Link className="btn" href="/home">Open the platform</Link>
      </section>
    </div>
  );
}
