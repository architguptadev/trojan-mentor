"use client";

import { useApp } from "@/lib/store";
import { Loading, fmtDateTime } from "@/components/bits";
import { Avatar } from "@/components/People";
import { cohortMetrics } from "@/domain/metrics";
import { LOCKED_STAGES, mentorEligibility } from "@/domain/cohort";

export default function Dashboard() {
  const { state, ready } = useApp();
  if (!ready) return <Loading />;
  const k = cohortMetrics(state);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const live = state.matches.filter((m) => m.stage === "proposed" || LOCKED_STAGES.includes(m.stage));

  const headline =
    k.unmatched === null
      ? "The cohort hasn’t been matched yet"
      : `${k.withMentor} of ${k.participating} students have a mentor${k.meetingsHeld ? `, and ${k.meetingsHeld} ${k.meetingsHeld === 1 ? "pair has" : "pairs have"} met` : ""}`;

  const progressing = state.matches.filter((m) => LOCKED_STAGES.includes(m.stage) && m.milestones.some((x) => x.done)).length;
  const steps = [
    { label: "Taking part", n: k.participating, note: `${k.studentsTotal - k.participating} chose not to be matched` },
    { label: "Have a mentor", n: k.withMentor, note: k.unmatched === null ? "Matching hasn’t run yet" : `${k.unmatched} not matched yet, each with a reason` },
    { label: "Both said yes", n: k.bilateral, note: `${k.awaitingDecisions} still deciding` },
    { label: "Introduced", n: k.introductions, note: `${k.pendingApprovals} draft${k.pendingApprovals === 1 ? "" : "s"} waiting for approval` },
    { label: "Met", n: k.meetingsHeld, note: `${k.invites} meeting${k.invites === 1 ? "" : "s"} scheduled` },
    { label: "Making progress", n: progressing, note: `${k.milestonesDone} of ${k.milestonesTotal} milestones done` },
  ];
  const base = Math.max(1, k.participating);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{headline}</h1>
        <p className="lede">Counted just now from this browser’s demo cohort. Every person and every action here is fictional demo activity.</p>
      </header>

      <section aria-label="Cohort figures" className="card funnel">
        {steps.map((x) => (
          <div key={x.label} className="funnel-row">
            <p className="funnel-label">{x.label}</p>
            <div className="funnel-bar" aria-hidden="true"><span style={{ width: `${Math.max(x.n ? 2 : 0, (x.n / base) * 100)}%` }} /></div>
            <p className="funnel-n num">{x.n}</p>
            <p className="funnel-note">{x.note}</p>
          </div>
        ))}
        <p className="tiny muted" style={{ margin: "14px 0 0" }}>
          Mentor places in use: {k.seatsHeld} of {k.capacity}. Failed send attempts: {k.failedAttempts}, with no duplicates.
        </p>
      </section>

      <div className="section grid-2">
        <section aria-labelledby="cap-title">
          <h2 id="cap-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Mentor places</h2>
          <ul className="card" style={{ listStyle: "none", margin: 0, padding: "6px 20px" }}>
            {state.mentors.map((m, i) => {
              const used = live.filter((x) => x.mentorId === m.id).length;
              const off = mentorEligibility(m);
              return (
                <li key={m.id} style={{ display: "grid", gridTemplateColumns: "36px 1fr 96px", gap: 12, alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <Avatar id={m.id} name={m.name} size={36} />
                  <div>
                    <p className="person-name" style={{ fontSize: "1rem" }}>{m.name}</p>
                    <p className="person-meta">{off ? (/paused/i.test(off) ? "Paused this term" : "Not taking students") : `${used} of ${m.capacity} filled`}</p>
                  </div>
                  <div className="meter" aria-hidden="true"><span style={{ width: `${pct(used, m.capacity)}%`, background: "var(--gold)" }} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="log-title">
          <h2 id="log-title" style={{ fontSize: "1.35rem", marginBottom: 12 }}>Recent activity</h2>
          <ol className="history card" style={{ padding: "18px 20px 6px", maxHeight: 420, overflowY: "auto" }}>
            {[...state.auditLog].reverse().slice(0, 14).map((e, i) => (
              <li key={i}>
                <time dateTime={e.at}>{fmtDateTime(e.at)}</time>
                {e.message}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
