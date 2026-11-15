"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Loading, fmtDateTime } from "@/components/bits";
import { cohortMetrics } from "@/domain/metrics";
import { LOCKED_STAGES, mentorEligibility } from "@/domain/cohort";

export default function Dashboard() {
  const { state, ready } = useApp();
  if (!ready) return <Loading />;
  const k = cohortMetrics(state);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const live = state.matches.filter((m) => m.stage === "proposed" || LOCKED_STAGES.includes(m.stage));

  const rows = [
    {
      figure: `${k.withMentor}`,
      of: `of ${k.participating}`,
      title: "Students with a proposed or approved mentor",
      body: k.unmatched === null
        ? "The cohort hasn’t been allocated yet."
        : `${pct(k.withMentor, k.participating)}% of participating students. ${k.unmatched} not matched in the latest run, each with a stated reason on the cohort page. ${k.studentsTotal - k.participating} not participating.`,
    },
    {
      figure: `${k.seatsHeld}`,
      of: `of ${k.capacity}`,
      title: "Mentor seats in use",
      body: `${k.mentorsActive} of ${k.mentorsTotal} alumni are opted in and visible. Seats count proposals and approved matches.`,
    },
    {
      figure: `${k.bilateral}`,
      of: k.awaitingDecisions ? `+${k.awaitingDecisions} pending` : "",
      title: "Matches approved by both student and mentor",
      body: `${k.awaitingDecisions} proposal${k.awaitingDecisions === 1 ? " is" : "s are"} still waiting on at least one person.`,
    },
    {
      figure: `${k.introductions}`,
      of: "",
      title: "Introductions recorded (simulated)",
      body: `${k.pendingApprovals} outgoing draft${k.pendingApprovals === 1 ? "" : "s"} waiting for approval. ${k.failedAttempts} failed attempt${k.failedAttempts === 1 ? "" : "s"} so far, with ${k.deliveries} total simulated deliver${k.deliveries === 1 ? "y" : "ies"} and no duplicates.`,
    },
    {
      figure: `${k.meetingsHeld}`,
      of: k.invites ? `of ${k.invites} scheduled` : "",
      title: "First meetings confirmed as held",
      body: "Confirmed by a participant after a simulated calendar invitation was approved and recorded.",
    },
    {
      figure: `${k.milestonesDone}`,
      of: `of ${k.milestonesTotal}`,
      title: "Development milestones completed",
      body: "Across all approved matches. Milestones are template-based suggestions from each student’s reviewed goals.",
    },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Cohort dashboard</p>
        <h1>Where the cohort stands</h1>
        <p className="lede">Calculated just now from the current state of this browser’s demo cohort. All activity shown is fictional demo activity — not real users, adoption or outcomes.</p>
      </header>

      <div className="split">
        <section aria-label="Cohort figures" className="ledger">
          {rows.map((r) => (
            <div className="ledger-row" key={r.title}>
              <p className="ledger-figure num" style={{ margin: 0 }}>
                {r.figure}
                {r.of && <small>{r.of}</small>}
              </p>
              <div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            </div>
          ))}
        </section>

        <aside className="stack" style={{ ["--stack" as string]: "32px" }}>
          <section aria-labelledby="cap-title">
            <h2 id="cap-title" style={{ fontSize: "1.3rem", marginBottom: 12 }}>Mentor capacity</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Mentor</th><th scope="col">Seats</th></tr></thead>
                <tbody>
                  {state.mentors.map((m) => {
                    const used = live.filter((x) => x.mentorId === m.id).length;
                    const off = mentorEligibility(m);
                    return (
                      <tr key={m.id}>
                        <td className="small"><span className="serif" style={{ fontSize: "1rem" }}>{m.name}</span>{off && <div className="tiny muted">{off}</div>}</td>
                        <td className="num small" style={{ minWidth: 100 }}>
                          {used} / {m.capacity}
                          <div className="meter meter-gold" style={{ marginTop: 6 }} aria-hidden="true"><span style={{ width: `${pct(used, m.capacity)}%` }} /></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="log-title">
            <h2 id="log-title" style={{ fontSize: "1.3rem", marginBottom: 12 }}>Recent activity</h2>
            <ol className="history" style={{ maxHeight: 360, overflowY: "auto" }}>
              {[...state.auditLog].reverse().slice(0, 14).map((e, i) => (
                <li key={i} style={{ gridTemplateColumns: "92px 1fr" }}>
                  <time dateTime={e.at}>{fmtDateTime(e.at)}</time>
                  <span>{e.message}</span>
                </li>
              ))}
            </ol>
            <p className="tiny muted" style={{ marginTop: 10 }}>Demo activity in this browser only. <Link href="/demo">Back to the guided demo</Link></p>
          </section>
        </aside>
      </div>
    </div>
  );
}
