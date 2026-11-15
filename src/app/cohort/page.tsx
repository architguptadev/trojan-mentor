"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Fictional, Loading, StageTag, first, fmtDateTime, topReasons } from "@/components/bits";
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
  const lockedCount = state.matches.filter((m) => LOCKED_STAGES.includes(m.stage)).length;

  const greedyDiff = run
    ? run.greedyAssigned.filter((g) => !run.assigned.some((a) => a.studentId === g.studentId && a.mentorId === g.mentorId))
    : [];
  const greedyMissing = run ? run.assigned.filter((a) => !run.greedyAssigned.some((g) => g.studentId === a.studentId)) : [];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Cohort allocation</p>
        <div className="row-between" style={{ alignItems: "end" }}>
          <div>
            <h1>Allocate the whole cohort at once</h1>
            <p className="lede">
              The optimizer finds the set of pairings with the highest total compatibility, within every mentor’s capacity,
              one mentor per student, and only above a {DEFAULT_THRESHOLD}-point threshold.
            </p>
          </div>
          <div className="stack" style={{ ["--stack" as string]: "6px", textAlign: "right" }}>
            <button className="btn" disabled={!isCoordinator} onClick={() => apply((s) => runAllocation(s), "Allocation complete. Proposals are waiting for both parties.")}>
              {run ? "Re-run allocation" : "Run allocation"}
            </button>
            {!isCoordinator && <span className="small muted">Switch to Program coordinator to run.</span>}
            {run && isCoordinator && (
              <button className="btn btn-small btn-quiet" onClick={() => download("trojan-mentor-cohort.csv", cohortCsv(state), "text/csv;charset=utf-8")}>
                Export allocation (CSV)
              </button>
            )}
          </div>
        </div>
      </header>

      {!run ? (
        <div className="empty">
          <h3>No allocation yet</h3>
          <p>
            {state.students.filter((s) => !studentEligibility(s)).length} students and {state.mentors.filter((m) => !mentorEligibility(m)).length} mentors are ready.
            Running allocation proposes pairs; nobody is contacted and both sides must approve.
          </p>
          {isCoordinator ? (
            <button className="btn" onClick={() => apply((s) => runAllocation(s), "Allocation complete. Proposals are waiting for both parties.")}>
              Run allocation
            </button>
          ) : (
            <p className="small">Switch to Program coordinator in “Viewing as” to run it.</p>
          )}
        </div>
      ) : (
        <>
          <section aria-labelledby="result-title" className="grid-2" style={{ marginBottom: 40 }}>
            <div>
              <h2 id="result-title" style={{ marginBottom: 10 }}>
                {run.assigned.length + lockedCount} of {state.students.filter((s) => !studentEligibility(s)).length} participating students have a mentor
              </h2>
              <p className="muted small">
                Run {run.id.replace("run-", "#")} at {fmtDateTime(run.at)}. {lockedCount > 0 && `${lockedCount} already-approved match${lockedCount > 1 ? "es were" : " was"} kept fixed. `}
                Total compatibility of new proposals: <strong className="num">{run.totalScore}</strong>.
              </p>
            </div>
            <div className="panel-quiet">
              <h3 style={{ fontSize: "1.05rem", marginBottom: 6 }}>Why not just give everyone their top match?</h3>
              {run.greedyTotal < run.totalScore ? (
                <p className="small" style={{ margin: 0 }}>
                  Greedy matching (best pair first) would total <strong className="num">{run.greedyTotal}</strong> and match{" "}
                  {run.greedyAssigned.length} students. The optimizer totals <strong className="num">{run.totalScore}</strong> and matches {run.assigned.length}.
                  {greedyDiff.slice(0, 1).map((g) => (
                    <span key={g.studentId}>
                      {" "}Greedy would pair {first(S(g.studentId).name)} with {first(M(g.mentorId).name)} ({g.score})
                      {greedyMissing[0] && <>, leaving {first(S(greedyMissing[0].studentId).name)} without a mentor</>}.
                    </span>
                  ))}
                </p>
              ) : (
                <p className="small" style={{ margin: 0 }}>
                  On this run, greedy matching happens to reach the same total ({run.greedyTotal}). The optimizer guarantees the
                  highest total even when it doesn’t.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="pairs-title" style={{ marginBottom: 48 }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h2 id="pairs-title">Pairings</h2>
              <span className="small muted">Scores are heuristic points (0–100), not probabilities.</span>
            </div>
            {live.length === 0 ? (
              <div className="empty"><h3>No pairings</h3><p>No pair cleared the threshold under current consent and capacity.</p></div>
            ) : (
              <div>
                {live.map((m) => {
                  const s = S(m.studentId);
                  const mt = M(m.mentorId);
                  return (
                    <article key={m.id} className="proposal" aria-label={`${s.name} and ${mt.name}`}>
                      <div>
                        <p className="person-name">{s.name}</p>
                        <p className="person-meta" style={{ margin: "2px 0 8px" }}>
                          Student · {s.school.replace(/ (School|College) of .*/, "")} · {s.program}
                        </p>
                        <p className="small" style={{ margin: 0 }}>
                          <span className="muted">with </span>
                          <span className="serif" style={{ fontSize: "1.05rem" }}>{mt.name}</span>
                          <br />
                          <span className="person-meta">{mt.headline}</span>
                        </p>
                      </div>
                      <div>
                        <ul className="reasons">
                          {topReasons(s, mt).map((r) => (
                            <li key={r.key}>
                              <span className="pts num">+{r.points}</span>
                              <span>{r.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="stack" style={{ ["--stack" as string]: "10px" }}>
                        <p className="score num" aria-label={`Heuristic score ${m.score} of 100`}>
                          {m.score}
                          <small>heuristic points</small>
                        </p>
                        <StageTag stage={m.stage} />
                        <Link href={`/matches/${m.id}`} className="small">
                          Open match →
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="unmatched-title" style={{ marginBottom: 48 }}>
            <h2 id="unmatched-title" style={{ marginBottom: 6 }}>Not matched this round</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>
              We’d rather leave someone unmatched than invent a connection. Each reason is computed from the data.
            </p>
            {run.unmatched.length === 0 ? (
              <p>Every participating student received a proposal.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">Students without a proposal and why</caption>
                  <thead>
                    <tr><th scope="col">Student</th><th scope="col">Goal</th><th scope="col">Why</th></tr>
                  </thead>
                  <tbody>
                    {run.unmatched.map((u) => {
                      const s = state.students.find((x) => x.id === u.studentId);
                      if (!s) return null;
                      return (
                        <tr key={u.studentId}>
                          <td style={{ minWidth: 150 }}><span className="serif">{s.name}</span></td>
                          <td style={{ minWidth: 180 }} className="small">{s.careerGoals}</td>
                          <td style={{ minWidth: 260 }} className="small">{u.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {run.ineligibleMentors.length > 0 && (
              <p className="small muted" style={{ marginTop: 12 }}>
                Not in this round:{" "}
                {run.ineligibleMentors.map((x, i) => (
                  <span key={x.mentorId}>{i > 0 && "; "}{M(x.mentorId)?.name ?? "A mentor"} — {x.reason.toLowerCase()}</span>
                ))}
              </p>
            )}
          </section>

          <Insights />
        </>
      )}

      <section aria-labelledby="roster-title" className="grid-2">
        <div>
          <h2 id="roster-title" style={{ marginBottom: 12 }}>Students</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Name</th><th scope="col">School</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {state.students.map((s) => (
                  <tr key={s.id}>
                    <td><span className="serif">{s.name}</span> {s.fictional && <span className="sr-only">(fictional)</span>}</td>
                    <td className="small">{s.school.replace(/ (School|College) of .*/, "").replace(/ School for .*/, "")}</td>
                    <td className="small">{studentEligibility(s) ? <span className="tag tag-neutral">Not matching</span> : <span className="tag tag-ok">Participating</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 style={{ marginBottom: 12 }}>Alumni mentors</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Name</th><th scope="col">Seats</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {state.mentors.map((m) => {
                  const used = live.filter((x) => x.mentorId === m.id).length;
                  return (
                    <tr key={m.id}>
                      <td><span className="serif">{m.name}</span></td>
                      <td className="num small" style={{ minWidth: 110 }}>
                        {used} of {m.capacity}
                        <div className="meter" style={{ marginTop: 6 }} aria-hidden="true"><span style={{ width: `${Math.min(100, (used / Math.max(1, m.capacity)) * 100)}%` }} /></div>
                      </td>
                      <td className="small">{mentorEligibility(m) ? <span className="tag tag-neutral">{m.visibility === "paused" ? "Paused" : "Not matching"}</span> : <span className="tag tag-ok">Opted in</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}><Fictional /> Everyone listed is fictional.</p>
        </div>
      </section>
    </div>
  );
}

function Insights() {
  const { state } = useApp();
  const seats = seatInsights(state).slice(0, 4);
  const gaps = recruitingGaps(state).filter((g) => g.directions.length);
  const name = (id: string) => state.students.find((s) => s.id === id)?.name.split(" ")[0] ?? "a student";
  const mentor = (id: string) => state.mentors.find((m) => m.id === id);
  if (!seats.length && !gaps.length) return null;
  return (
    <section aria-labelledby="insights-title" style={{ marginBottom: 48 }}>
      <h2 id="insights-title" style={{ marginBottom: 6 }}>Where more mentors would help</h2>
      <p className="muted small" style={{ marginBottom: 18, maxWidth: "70ch" }}>
        Computed by re-running the same optimizer with one extra seat per mentor. These are exact what-ifs on the current data, not predictions.
        Use them to make a specific, low-pressure ask.
      </p>
      <div className="grid-2">
        {seats.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Effect of one more mentor seat</caption>
              <thead><tr><th scope="col">If this mentor took one more student</th><th scope="col">Cohort total</th><th scope="col">Newly matched</th></tr></thead>
              <tbody>
                {seats.map((x) => (
                  <tr key={x.mentorId}>
                    <td><span className="serif">{mentor(x.mentorId)?.name}</span><div className="tiny muted">now {mentor(x.mentorId)?.capacity} seat{mentor(x.mentorId)?.capacity === 1 ? "" : "s"}</div></td>
                    <td className="num" style={{ color: "var(--green)", fontWeight: 600 }}>+{x.gain}</td>
                    <td className="small">{x.newlyMatched.length ? x.newlyMatched.map(name).join(", ") : "No one new; better fits for others"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gaps.length > 0 && (
          <div className="panel-quiet stack" style={{ ["--stack" as string]: "10px" }}>
            <h3 style={{ fontSize: "1.05rem" }}>Directions no opted-in alumni cover</h3>
            {gaps.map((g) => (
              <p key={g.studentId} className="small" style={{ margin: 0 }}>
                <strong>{name(g.studentId)}</strong> is aiming for {list(g.directions).toLowerCase()}. No current mentor shares that direction, so recruiting one alum in this area is the only way to a good match.
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
