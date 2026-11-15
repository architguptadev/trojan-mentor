"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Loading, StageTag, first } from "@/components/bits";
import { Person, Thread, shortSchool } from "@/components/People";
import { inboxFor, type InboxItem } from "@/domain/inbox";
import { cohortMetrics } from "@/domain/metrics";
import { LOCKED_STAGES, mentorEligibility, studentEligibility } from "@/domain/cohort";
import { slotLabel } from "@/domain/compatibility";
import { list } from "@/domain/compatibility";
import { setMentorVisibility } from "@/domain/workflow";
import type { AppState, Match, MentorProfile, StudentProfile } from "@/domain/types";

export default function Home() {
  const { state, ready, role } = useApp();
  if (!ready) return <Loading />;
  const inbox = inboxFor(state, role);
  if (role.kind === "student") {
    const s = state.students.find((x) => x.id === role.id);
    if (s) return <StudentHome state={state} s={s} inbox={inbox} />;
  }
  if (role.kind === "mentor") {
    const m = state.mentors.find((x) => x.id === role.id);
    if (m) return <MentorHome state={state} m={m} inbox={inbox} />;
  }
  return <CoordinatorHome state={state} inbox={inbox} />;
}

function Todo({ items, empty }: { items: InboxItem[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ol className="todo">
      {items.map((i, n) => (
        <li key={i.key} data-next={n === 0}>
          <span className="mark" aria-hidden="true">{n + 1}</span>
          <p style={{ fontSize: "0.98rem", color: "var(--ink)" }}>{i.text}</p>
          <Link className={`btn btn-small ${n === 0 ? "" : "btn-secondary"}`} href={i.href}>Open<span className="sr-only">: {i.text}</span></Link>
        </li>
      ))}
    </ol>
  );
}

function currentMatch(state: AppState, pred: (m: Match) => boolean) {
  const mine = state.matches.filter(pred);
  return mine.find((m) => LOCKED_STAGES.includes(m.stage)) ?? mine.find((m) => m.stage === "proposed") ?? null;
}

function StudentHome({ state, s, inbox }: { state: AppState; s: StudentProfile; inbox: InboxItem[] }) {
  const match = currentMatch(state, (m) => m.studentId === s.id);
  const m = match ? state.mentors.find((x) => x.id === match.mentorId) : undefined;
  const run = state.allocationRuns.at(-1);
  const unmatched = run?.unmatched.find((u) => u.studentId === s.id);
  const off = studentEligibility(s);
  const done = match?.milestones.filter((x) => x.done).length ?? 0;
  const mf = m ? first(m.name) : "";

  let lede: string;
  if (off) lede = "You’re not included in matching right now. You can change that in Privacy.";
  else if (match && m) {
    const mine = match.student.decision;
    lede =
      match.stage === "proposed"
        ? mine === "pending" ? `We think ${mf} would be a good mentor for you. Take a look and decide.` : `You said yes. Now waiting for ${mf}.`
        : match.stage === "approved" ? `You and ${mf} both said yes. Your introduction is being prepared.`
        : match.stage === "introduced" ? `You’ve been introduced to ${mf}. Next, pick a time for your first conversation.`
        : match.stage === "meeting_scheduled" ? `Your first conversation with ${mf} is set for ${match.meeting?.startsAt}.`
        : `${done} of ${match.milestones.length} milestones done with ${mf}.`;
  } else if (unmatched) lede = unmatched.reason;
  else lede = "You’re in the next matching round. We’ll suggest a mentor once the program runs matching.";

  return (
    <div className="page">
      <header className="page-head">
        <h1>Hi, {first(s.name)}</h1>
        <p className="lede">{lede}</p>
      </header>
      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "40px" }}>
          {match && m && (
            <section className="card stack" aria-label="Your mentor" style={{ ["--stack" as string]: "18px", padding: "clamp(20px, 3vw, 30px)" }}>
              <Thread size={56} score={match.score}
                left={<Person id={s.id} name={s.name} meta="You" size={56} />}
                right={<Person id={m.id} name={m.name} meta={m.headline.replace(/ \(fictional\)/g, "")} size={56} />} />
              <div className="row-between">
                <StageTag stage={match.stage} />
                <Link className="btn btn-small" href={`/matches/${match.id}`}>{inbox.some((i) => i.href.endsWith(match.id)) ? "Take the next step" : "Open your match"}</Link>
              </div>
            </section>
          )}
          <section aria-labelledby="todo-title">
            <h2 id="todo-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Waiting on you</h2>
            <Todo items={inbox} empty="Nothing right now." />
          </section>
          {!match && !off && (
            <section className="card-sunk" aria-labelledby="next-title">
              <h2 id="next-title" style={{ fontSize: "1.2rem", marginBottom: 10 }}>What happens next</h2>
              <ol className="small" style={{ margin: 0, paddingLeft: 20, color: "var(--ink-2)" }}>
                <li style={{ marginBottom: 6 }}>The program matches everyone at once, so suggestions are fair across the cohort.</li>
                <li style={{ marginBottom: 6 }}>If an alum is a good fit, you’ll see them here and decide. They decide too.</li>
                <li>Only when you both say yes does anyone get introduced.</li>
              </ol>
              <p className="small" style={{ margin: "12px 0 0" }}>A sharper profile helps. <Link href="/profile">Edit your profile</Link></p>
            </section>
          )}
          {match && match.milestones.length > 0 && (
            <section aria-labelledby="ms-title">
              <div className="section-head">
                <h2 id="ms-title" style={{ fontSize: "1.35rem" }}>Your milestones</h2>
                <Link className="small" href={`/matches/${match.id}`}>Update them</Link>
              </div>
              <ul className="milestones">
                {match.milestones.map((x) => (
                  <li key={x.id} data-done={x.done}>
                    <span className={`tag ${x.done ? "tag-ok" : "tag-neutral"}`} aria-label={x.done ? "Done" : "Not done"} />
                    <div><label style={{ cursor: "default" }}>{x.title}</label></div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <ProfileCard
          lines={[
            ["Goal", s.careerGoals],
            ["School", `${shortSchool(s.school)}, ${s.program}, class of ${s.gradYear}`],
            ["Aiming for", list([...s.targetRoles, ...s.industries]) || "Not set"],
            ["Skills", list(s.skills) || "Not set"],
            ["Free", list(s.availability.map(slotLabel)) || "Not set"],
          ]}
        />
      </div>
    </div>
  );
}

function MentorHome({ state, m, inbox }: { state: AppState; m: MentorProfile; inbox: InboxItem[] }) {
  const { apply } = useApp();
  const mine = state.matches.filter((x) => x.mentorId === m.id && (x.stage === "proposed" || LOCKED_STAGES.includes(x.stage)));
  const active = mine.filter((x) => LOCKED_STAGES.includes(x.stage)).length;
  const pending = mine.filter((x) => x.stage === "proposed" && x.mentor.decision === "pending").length;
  const off = mentorEligibility(m);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Hi, {first(m.name)}</h1>
        <p className="lede">
          {off ? `You’re not taking new students right now (${off.toLowerCase().replace(/\.$/, "")}).` : pending ? `You have ${pending} suggested student${pending === 1 ? "" : "s"} to look at.${active ? ` You’re mentoring ${active} already.` : ""}` : active ? `You’re mentoring ${active} of the ${m.capacity} student${m.capacity === 1 ? "" : "s"} you said you could take.` : `You’re open to ${m.capacity} student${m.capacity === 1 ? "" : "s"}. Suggestions appear here after the next matching round.`}
        </p>
      </header>
      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "40px" }}>
          <section aria-labelledby="todo-title">
            <h2 id="todo-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Waiting on you</h2>
            <Todo items={inbox} empty="Nothing right now." />
          </section>
          <section aria-labelledby="students-title">
            <h2 id="students-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Your students</h2>
            {mine.length === 0 ? (
              <p className="muted">No students yet. You’ll see suggestions here after the next matching round.</p>
            ) : (
              <div className="pairings">
                {mine.map((x) => {
                  const s = state.students.find((y) => y.id === x.studentId)!;
                  return (
                    <article key={x.id} className="row-between card" style={{ padding: "16px 20px" }}>
                      <Person id={s.id} name={s.name} meta={s.careerGoals} />
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <StageTag stage={x.stage} />
                        <Link className="btn btn-small btn-secondary" href={`/matches/${x.id}`}>Open<span className="sr-only"> match with {s.name}</span></Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <div className="stack" style={{ ["--stack" as string]: "20px" }}>
          <section className="card stack" aria-labelledby="avail-title" style={{ ["--stack" as string]: "12px" }}>
            <h2 id="avail-title" style={{ fontSize: "1.2rem" }}>New students</h2>
            <label className="choice">
              <input type="checkbox" checked={m.visibility === "visible"} onChange={(e) => apply((st) => setMentorVisibility(st, m.id, e.target.checked ? "visible" : "paused"), e.target.checked ? "You’re open to new students." : "Paused. You won’t be suggested to new students.")} />
              <span><strong>Open to new students</strong><span className="hint">Pausing keeps your current students.</span></span>
            </label>
            <p className="small muted" style={{ margin: 0 }}>Taking up to {m.capacity}. <Link href="/profile">Change</Link></p>
          </section>
          <ProfileCard
            lines={[
              ["Now", m.headline.replace(/ \(fictional\)/g, "")],
              ["Can help with", list(m.expertise)],
              ["Free", list(m.availability.map(slotLabel))],
              ["Mentoring style", m.mentoringPreferences],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function CoordinatorHome({ state, inbox }: { state: AppState; inbox: InboxItem[] }) {
  const k = cohortMetrics(state);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Program overview</h1>
        <p className="lede">
          {k.unmatched === null
            ? `${k.participating} students and ${k.mentorsActive} alumni are ready to be matched.`
            : `${k.withMentor} of ${k.participating} students have a mentor, ${k.bilateral} pair${k.bilateral === 1 ? " has" : "s have"} both said yes and ${k.meetingsHeld} ${k.meetingsHeld === 1 ? "has" : "have"} met.`}
        </p>
      </header>
      <div className="split">
        <section aria-labelledby="todo-title">
          <h2 id="todo-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Waiting on you</h2>
          <Todo items={inbox} empty="Nothing needs the coordinator right now." />
        </section>
        <div className="stack" style={{ ["--stack" as string]: "14px" }}>
          <Link href="/cohort" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <h3 style={{ marginBottom: 4 }}>Cohort</h3>
            <p className="small muted" style={{ margin: 0 }}>Run matching, see who isn’t matched and where more mentors would help.</p>
          </Link>
          <Link href="/dashboard" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <h3 style={{ marginBottom: 4 }}>Dashboard</h3>
            <p className="small muted" style={{ margin: 0 }}>Progress from suggested pairs to first meetings and milestones.</p>
          </Link>
          <Link href="/onboard/alumni" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <h3 style={{ marginBottom: 4 }}>Add an alum</h3>
            <p className="small muted" style={{ margin: 0 }}>More mentor places means more students matched.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ lines }: { lines: [string, string][] }) {
  return (
    <section className="card" aria-labelledby="profile-title">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 id="profile-title" style={{ fontSize: "1.2rem" }}>Your profile</h2>
        <Link className="small" href="/profile">Edit</Link>
      </div>
      <dl style={{ margin: 0, display: "grid", gap: 12 }}>
        {lines.map(([k, v]) => (
          <div key={k}>
            <dt className="small muted">{k}</dt>
            <dd className="small" style={{ margin: 0 }}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="tiny muted" style={{ margin: "14px 0 0" }}><Link href="/privacy">Privacy and your data</Link></p>
    </section>
  );
}
