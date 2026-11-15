"use client";

import { useApp } from "@/lib/store";
import { Loading, fmtDateTime } from "@/components/bits";
import { Person } from "@/components/People";
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
        <span className="kicker">Dashboard</span>
        <h1>{headline}</h1>
        <p className="lede">Counted just now from this browser’s demo cohort. Every person and every action here is fictional demo activity.</p>
      </header>

      <section aria-label="Cohort figures" className="funnel">
        {steps.map((x) => (
          <div key={x.label} className="funnel-row">
            <p className="funnel-label">{x.label}</p>
            <div className="bar" aria-hidden="true"><span style={{ width: `${Math.max(x.n ? 2 : 0, (x.n / base) * 100)}%` }} /></div>
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
          <h2 id="cap-title" className="section-title">Mentor places</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Alum</th><th scope="col" className="num">Places</th><th scope="col" style={{ width: "35%" }}><span className="sr-only">Filled</span></th></tr></thead>
              <tbody>
                {state.mentors.map((m) => {
                  const used = live.filter((x) => x.mentorId === m.id).length;
                  const off = mentorEligibility(m);
                  return (
                    <tr key={m.id}>
                      <td><Person id={m.id} name={m.name} /></td>
                      <td className="small num">{off ? (/paused/i.test(off) ? "Paused" : "Not taking students") : `${used} of ${m.capacity}`}</td>
                      <td style={{ verticalAlign: "middle" }}>{!off && <div className="bar" aria-hidden="true"><span style={{ width: `${pct(used, m.capacity)}%`, background: "var(--gold)" }} /></div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="log-title">
          <h2 id="log-title" className="section-title">Recent activity</h2>
          <ol className="history" style={{ borderTop: "1px solid var(--line)", paddingTop: 14, maxHeight: 420, overflowY: "auto" }}>
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
