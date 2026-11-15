"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Loading, StageTag, first } from "@/components/bits";
import { Person, shortSchool } from "@/components/People";
import { inboxFor, type InboxItem } from "@/domain/inbox";
import { cohortMetrics } from "@/domain/metrics";
import { LOCKED_STAGES, mentorEligibility, studentEligibility } from "@/domain/cohort";
import { list, slotLabel } from "@/domain/compatibility";
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

function Waiting({ items, empty }: { items: InboxItem[]; empty: string }) {
  return (
    <section aria-labelledby="todo-title">
      <h2 id="todo-title" className="section-title">Waiting on you</h2>
      {items.length === 0 ? (
        <p className="muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>{empty}</p>
      ) : (
        <ol className="rows">
          {items.map((i, n) => (
            <li key={i.key} className="todo-row">
              <p>{i.text}</p>
              <Link className={`btn btn-small ${n === 0 ? "" : "btn-secondary"}`} href={i.href}>Open<span className="sr-only">: {i.text}</span></Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function currentMatch(state: AppState, pred: (m: Match) => boolean) {
  const mine = state.matches.filter(pred);
  return mine.find((m) => LOCKED_STAGES.includes(m.stage)) ?? mine.find((m) => m.stage === "proposed") ?? null;
}

function Facts({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <section aria-labelledby="facts-title">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 id="facts-title" className="section-title" style={{ margin: 0 }}>{title}</h2>
        <Link className="small" href="/profile">Edit</Link>
      </div>
      <dl className="facts" style={{ gridTemplateColumns: "110px minmax(0, 1fr)", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        {lines.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd className="small">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StudentHome({ state, s, inbox }: { state: AppState; s: StudentProfile; inbox: InboxItem[] }) {
  const match = currentMatch(state, (m) => m.studentId === s.id);
  const m = match ? state.mentors.find((x) => x.id === match.mentorId) : undefined;
  const unmatched = state.allocationRuns.at(-1)?.unmatched.find((u) => u.studentId === s.id);
  const off = studentEligibility(s);
  const done = match?.milestones.filter((x) => x.done).length ?? 0;
  const mf = m ? first(m.name) : "";

  let lede: string;
  if (off) lede = "You’re not included in matching right now. You can change that in Privacy.";
  else if (match && m) {
    lede =
      match.stage === "proposed"
        ? match.student.decision === "pending" ? `We think ${mf} would be a good mentor for you. Take a look and decide.` : `You said yes. Now waiting for ${mf}.`
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
        <div className="stack" style={{ ["--stack" as string]: "36px" }}>
          {match && m && (
            <section aria-labelledby="mentor-title">
              <h2 id="mentor-title" className="section-title">Your mentor</h2>
              <div className="rows">
                <div className="r row-between">
                  <Person id={m.id} name={m.name} meta={m.headline.replace(/ \(fictional\)/g, "")} size={36} />
                  <div className="row" style={{ gap: 14 }}>
                    <StageTag stage={match.stage} />
                    <Link className="btn btn-small" href={`/matches/${match.id}`}>Open match</Link>
                  </div>
                </div>
              </div>
            </section>
          )}
          <Waiting items={inbox} empty="Nothing right now." />
          {!match && !off && (
            <section aria-labelledby="next-title">
              <h2 id="next-title" className="section-title">What happens next</h2>
              <ol className="small" style={{ margin: 0, paddingLeft: 20, color: "var(--ink-2)" }}>
                <li style={{ marginBottom: 6 }}>The program matches everyone at once, so suggestions are fair across the cohort.</li>
                <li style={{ marginBottom: 6 }}>If an alum is a good fit, you’ll see them here and decide. They decide too.</li>
                <li>Only when you both say yes does anyone get introduced.</li>
              </ol>
            </section>
          )}
          {match && match.milestones.length > 0 && (
            <section aria-labelledby="ms-title">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h2 id="ms-title" className="section-title" style={{ margin: 0 }}>Milestones · {done} of {match.milestones.length} done</h2>
                <Link className="small" href={`/matches/${match.id}`}>Update</Link>
              </div>
              <ul className="rows">
                {match.milestones.map((x) => (
                  <li key={x.id} className="row" style={{ flexWrap: "nowrap" }}>
                    <span className={`tag ${x.done ? "tag-ok" : "tag-neutral"}`}>{x.done ? "Done" : "Open"}</span>
                    <span className="small">{x.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <Facts
          title="Your profile"
          lines={[
            ["Goal", s.careerGoals],
            ["School", `${shortSchool(s.school)}, ${s.program}, ${s.gradYear}`],
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
  const lede = off
    ? `You’re not taking new students right now (${off.toLowerCase().replace(/\.$/, "")}).`
    : pending
      ? `You have ${pending} suggested student${pending === 1 ? "" : "s"} to look at.${active ? ` You’re mentoring ${active} already.` : ""}`
      : active
        ? `You’re mentoring ${active} of the ${m.capacity} student${m.capacity === 1 ? "" : "s"} you said you could take.`
        : `You’re open to ${m.capacity} student${m.capacity === 1 ? "" : "s"}. Suggestions appear here after the next matching round.`;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Hi, {first(m.name)}</h1>
        <p className="lede">{lede}</p>
      </header>
      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "36px" }}>
          <Waiting items={inbox} empty="Nothing right now." />
          <section aria-labelledby="students-title">
            <h2 id="students-title" className="section-title">Your students</h2>
            {mine.length === 0 ? (
              <p className="muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>No students yet.</p>
            ) : (
              <ul className="rows">
                {mine.map((x) => {
                  const s = state.students.find((y) => y.id === x.studentId)!;
                  return (
                    <li key={x.id} className="row-between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                      <Person id={s.id} name={s.name} meta={s.careerGoals} size={36} />
                      <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
                        <StageTag stage={x.stage} />
                        <Link className="btn btn-small btn-secondary" href={`/matches/${x.id}`}>Open<span className="sr-only"> match with {s.name}</span></Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <div className="stack" style={{ ["--stack" as string]: "32px" }}>
          <section aria-labelledby="avail-title">
            <h2 id="avail-title" className="section-title">New students</h2>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <label className="check">
                <input type="checkbox" checked={m.visibility === "visible"} onChange={(e) => apply((st) => setMentorVisibility(st, m.id, e.target.checked ? "visible" : "paused"), e.target.checked ? "You’re open to new students." : "Paused. You won’t be suggested to new students.")} />
                <span>Open to new students<span className="hint" style={{ display: "block" }}>Pausing keeps your current students. Taking up to {m.capacity}. <Link href="/profile">Change</Link></span></span>
              </label>
            </div>
          </section>
          <Facts
            title="Your profile"
            lines={[
              ["Now", m.headline.replace(/ \(fictional\)/g, "")],
              ["Can help with", list(m.expertise)],
              ["Free", list(m.availability.map(slotLabel))],
              ["Mentoring", m.mentoringPreferences],
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
        <Waiting items={inbox} empty="Nothing needs the coordinator right now." />
        <nav aria-labelledby="go-title">
          <h2 id="go-title" className="section-title">Go to</h2>
          <ul className="rows">
            <li><Link href="/cohort" style={{ fontWeight: 600 }}>Cohort</Link><p className="small muted" style={{ margin: "2px 0 0" }}>Run matching, see who isn’t matched and where more mentors would help.</p></li>
            <li><Link href="/dashboard" style={{ fontWeight: 600 }}>Dashboard</Link><p className="small muted" style={{ margin: "2px 0 0" }}>Progress from suggested pairs to first meetings and milestones.</p></li>
            <li><Link href="/onboard/alumni" style={{ fontWeight: 600 }}>Add an alum</Link><p className="small muted" style={{ margin: "2px 0 0" }}>More mentor places means more students matched.</p></li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
