"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Loading, StageTag, first, topReasons } from "@/components/bits";
import { Person, shortSchool } from "@/components/People";
import { DEFAULT_THRESHOLD, LOCKED_STAGES, mentorEligibility, runAllocation, studentEligibility } from "@/domain/cohort";
import { recruitingGaps, seatInsights } from "@/domain/insights";
import { list } from "@/domain/compatibility";
import { cohortCsv, download } from "@/lib/export";

export default function CohortPage() {
  const { state, ready, apply, role } = useApp();
  if (!ready) return <Loading />;
  const run = state.allocationRuns.at(-1);
  const isCoordinator = role.kind === "coordinator";
  const live = state.matches.filter((m) => m.stage === "proposed" || LOCKED_STAGES.includes(m.stage));
  const S = (id: string) => state.students.find((s) => s.id === id)!;
  const M = (id: string) => state.mentors.find((m) => m.id === id)!;
  const participating = state.students.filter((s) => !studentEligibility(s)).length;
  const activeMentors = state.mentors.filter((m) => !mentorEligibility(m)).length;
  const allocate = () => apply((s) => runAllocation(s), "Cohort matched. Each pair now waits for both people to approve.");
  const greedyDiff = run ? run.greedyAssigned.find((g) => !run.assigned.some((a) => a.studentId === g.studentId && a.mentorId === g.mentorId)) : undefined;
  const greedyMissing = run ? run.assigned.find((a) => !run.greedyAssigned.some((g) => g.studentId === a.studentId)) : undefined;

  return (
    <div className="page">
      <header className="page-head page-head-row">
        <div>
          <span className="kicker">Cohort</span>
          <h1>{run ? `${live.length} of ${participating} students have a mentor` : "Match the cohort"}</h1>
          <p className="lede">
            {run
              ? "Everyone is placed at once for the best overall fit, within what each alum said they can take."
              : `${participating} students and ${activeMentors} alumni are ready. Matching suggests pairs; no one is contacted until both people approve.`}
          </p>
        </div>
        <div className="actions">
          {run && isCoordinator && <button className="link small" onClick={() => download("trojan-mentor-cohort.csv", cohortCsv(state), "text/csv;charset=utf-8")}>Export allocation (CSV)</button>}
          <button className={`btn ${run ? "btn-secondary" : ""}`} disabled={!isCoordinator} onClick={allocate}>{run ? "Re-run allocation" : "Run allocation"}</button>
        </div>
      </header>
      {!isCoordinator && <p className="small muted" style={{ marginTop: -8 }}>Only the program coordinator can run matching. Switch accounts at the top right.</p>}

      {!run ? (
        <div className="grid-2 section" style={{ marginTop: 12 }}>
          <People title={`Students (${state.students.length})`} people={state.students.map((s) => ({ id: s.id, name: s.name, meta: s.careerGoals, off: studentEligibility(s) }))} />
          <People title={`Alumni (${state.mentors.length})`} people={state.mentors.map((m) => ({ id: m.id, name: m.name, meta: `${m.headline.replace(/ \(fictional\)/, "")}. Up to ${m.capacity}.`, off: mentorEligibility(m) }))} />
        </div>
      ) : (
        <>
          {run.greedyTotal < run.totalScore && greedyDiff && greedyMissing && (
            <section aria-labelledby="why-title" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "18px 0", margin: "8px 0 8px" }}>
              <div className="row-between" style={{ alignItems: "flex-start", gap: 24 }}>
                <div style={{ maxWidth: "52ch" }}>
                  <h2 id="why-title" style={{ fontSize: "1.15rem", marginBottom: 6 }}>Why not give everyone their top match?</h2>
                  <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
                    Going best-pair-first would give {first(M(greedyDiff.mentorId).name)} to {first(S(greedyDiff.studentId).name)} and leave{" "}
                    {first(S(greedyMissing.studentId).name)} with no one. Looking at the whole cohort finds a better answer for both.
                  </p>
                </div>
                <dl className="row compare" style={{ gap: 32, margin: 0 }}>
                  <div><dt className="tiny muted">Top match first</dt><dd className="serif num" style={{ margin: 0, fontSize: "1.8rem", lineHeight: 1.1 }}>{run.greedyTotal}</dd><dd className="tiny muted" style={{ margin: 0 }}>{run.greedyAssigned.length} matched</dd></div>
                  <div><dt className="tiny muted">Whole cohort</dt><dd className="serif num" style={{ margin: 0, fontSize: "1.8rem", lineHeight: 1.1, color: "var(--cardinal)" }}>{run.totalScore}</dd><dd className="tiny muted" style={{ margin: 0 }}>{run.assigned.length} matched</dd></div>
                </dl>
              </div>
            </section>
          )}

          <section aria-labelledby="pairs-title" className="section" style={{ marginTop: 28 }}>
            <div className="section-head">
              <h2 id="pairs-title">Pairings</h2>
              <p className="small muted">Fit out of 100, from shared goals, skills, school, communities and free time.</p>
            </div>
            {live.length === 0 ? (
              <div className="empty"><h3>No pairings yet</h3><p>No pair was a good enough fit with the current alumni and their capacity.</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">Suggested and approved pairings</caption>
                  <thead><tr><th scope="col">Student</th><th scope="col">Mentor</th><th scope="col" className="num">Fit</th><th scope="col">Main reason</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {live.map((m) => {
                      const s = S(m.studentId);
                      const mt = M(m.mentorId);
                      return (
                        <tr key={m.id}>
                          <td style={{ minWidth: 170 }}><Person id={s.id} name={s.name} meta={shortSchool(s.school)} /></td>
                          <td style={{ minWidth: 170 }}><Person id={mt.id} name={mt.name} meta={mt.headline.replace(/,.*$/, "")} /></td>
                          <td className="num serif" style={{ fontSize: "1.15rem" }}>{m.score}</td>
                          <td className="small" style={{ color: "var(--ink-2)", minWidth: 220 }}>{topReasons(s, mt, 1)[0]?.reason}</td>
                          <td style={{ minWidth: 150 }}>
                            <StageTag stage={m.stage} />
                            <div><Link className="small" href={`/matches/${m.id}`}>Open match<span className="sr-only"> for {s.name} and {mt.name}</span></Link></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="unmatched-title" className="section">
            <div className="section-head">
              <h2 id="unmatched-title">Not matched this round</h2>
              <p className="small muted">We’d rather say so than pair someone badly.</p>
            </div>
            {run.unmatched.length === 0 ? (
              <p className="muted">Every participating student has a suggested mentor.</p>
            ) : (
              <ul className="rows">
                {run.unmatched.map((u) => {
                  const s = state.students.find((x) => x.id === u.studentId);
                  if (!s) return null;
                  return (
                    <li key={u.studentId} className="r-grid" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) minmax(0, 2fr)", gap: "6px 24px" }}>
                      <Person id={s.id} name={s.name} meta={shortSchool(s.school)} />
                      <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>{u.reason}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            {run.ineligibleMentors.length > 0 && (
              <p className="small muted" style={{ marginTop: 12 }}>
                {run.ineligibleMentors.map((x) => `${M(x.mentorId)?.name ?? "One alum"} is ${/paused/i.test(x.reason) ? "paused this term" : "not taking students right now"}`).join(". ")}.
              </p>
            )}
          </section>

          <Insights />

          <section className="section" aria-labelledby="places-title">
            <h2 id="places-title" style={{ marginBottom: 12 }}>Alumni places</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Alum</th><th scope="col" className="num">Places</th><th scope="col" style={{ width: "40%" }}><span className="sr-only">Filled</span></th></tr></thead>
                <tbody>
                  {state.mentors.map((m) => {
                    const used = live.filter((x) => x.mentorId === m.id).length;
                    const off = mentorEligibility(m);
                    return (
                      <tr key={m.id}>
                        <td><Person id={m.id} name={m.name} /></td>
                        <td className="small num">{off ? (/paused/i.test(off) ? "Paused" : "Not matching") : `${used} of ${m.capacity}`}</td>
                        <td style={{ verticalAlign: "middle" }}>{!off && <div className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (used / Math.max(1, m.capacity)) * 100)}%` }} /></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="small muted" style={{ marginTop: 28 }}>Pairs need a fit of at least {DEFAULT_THRESHOLD}. <Link href="/how-it-works">How matching works</Link></p>
    </div>
  );
}

function People({ title, people }: { title: string; people: { id: string; name: string; meta?: string; off: string | null }[] }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <ul className="rows">
        {people.map((p) => (
          <li key={p.id} className="row-between" style={{ flexWrap: "nowrap", alignItems: "flex-start", padding: "11px 0" }}>
            <Person id={p.id} name={p.name} meta={p.meta} />
            {p.off && <span className="tag tag-neutral">{/paused/i.test(p.off) ? "Paused" : "Not matching"}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Insights() {
  const { state } = useApp();
  const seats = seatInsights(state).filter((x) => x.newlyMatched.length).slice(0, 3);
  const gaps = recruitingGaps(state).filter((g) => g.directions.length);
  const name = (id: string) => state.students.find((s) => s.id === id)?.name.split(" ")[0] ?? "a student";
  const mentor = (id: string) => state.mentors.find((m) => m.id === id);
  if (!seats.length && !gaps.length) return null;
  return (
    <section aria-labelledby="insights-title" className="section">
      <div className="section-head">
        <h2 id="insights-title">Where more mentors would help</h2>
        <p className="small muted">Worked out by re-running the match with one change. Not a guess.</p>
      </div>
      <ul className="rows">
        {seats.map((x) => {
          const m = mentor(x.mentorId);
          if (!m) return null;
          return (
            <li key={x.mentorId}>
              One more place with <strong>{m.name}</strong> would match <strong>{list(x.newlyMatched.map(name))}</strong> and raise the cohort’s total fit by {x.gain}.
            </li>
          );
        })}
        {gaps.map((g) => (
          <li key={g.studentId}>
            No alum covers <strong>{list(g.directions).toLowerCase()}</strong>, which {name(g.studentId)} is aiming for. Recruiting one would give {name(g.studentId)} a real option.
          </li>
        ))}
      </ul>
    </section>
  );
}
