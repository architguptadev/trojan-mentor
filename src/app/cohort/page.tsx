"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Loading, StageTag, first, topReasons } from "@/components/bits";
import { Avatar, Person, Thread, shortSchool } from "@/components/People";
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
          <h1>{run ? `${live.length} of ${participating} students have a mentor` : "Match the cohort"}</h1>
          <p className="lede">
            {run
              ? "Everyone is placed at once to get the best overall fit, within what each alum said they can take."
              : `${participating} students and ${activeMentors} alumni are ready. Matching suggests pairs; no one is contacted until both people approve.`}
          </p>
        </div>
        <div className="row">
          {run && isCoordinator && (
            <button className="btn btn-quiet btn-small" onClick={() => download("trojan-mentor-cohort.csv", cohortCsv(state), "text/csv;charset=utf-8")}>
              Export allocation (CSV)
            </button>
          )}
          <button className={`btn ${run ? "btn-secondary" : ""}`} disabled={!isCoordinator} onClick={allocate}>
            {run ? "Re-run allocation" : "Run allocation"}
          </button>
        </div>
      </header>
      {!isCoordinator && <p className="notice small" style={{ marginTop: -12, marginBottom: 24 }}>Switch “Viewing as” to Program coordinator to run matching.</p>}

      {!run ? (
        <section aria-label="People in the cohort" className="grid-2">
          <PeopleList title="Students" people={state.students.map((s) => ({ id: s.id, name: s.name, meta: s.careerGoals, off: studentEligibility(s) }))} />
          <PeopleList title="Alumni" people={state.mentors.map((m) => ({ id: m.id, name: m.name, meta: `${m.headline.replace(/ \(fictional\)/, "")}. Up to ${m.capacity} student${m.capacity > 1 ? "s" : ""}.`, off: mentorEligibility(m) }))} />
        </section>
      ) : (
        <>
          {run.greedyTotal < run.totalScore && greedyDiff && greedyMissing && (
            <section aria-labelledby="why-title" className="card" style={{ marginBottom: 28 }}>
              <div className="split" style={{ alignItems: "center" }}>
                <div>
                  <h2 id="why-title" style={{ fontSize: "1.35rem", marginBottom: 8 }}>Why not give everyone their top match?</h2>
                  <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
                    Going down the list best-pair-first would give {first(M(greedyDiff.mentorId).name)} to {first(S(greedyDiff.studentId).name)} and
                    leave {first(S(greedyMissing.studentId).name)} with no one. Looking at the whole cohort finds a better answer for both.
                  </p>
                </div>
                <div className="compare">
                  <div>
                    <p className="small muted">Top match first</p>
                    <p className="figure">{run.greedyTotal}</p>
                    <p className="small">{run.greedyAssigned.length} students matched</p>
                  </div>
                  <div>
                    <p className="small muted">Whole cohort</p>
                    <p className="figure">{run.totalScore}</p>
                    <p className="small">{run.assigned.length} students matched</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="pairs-title">
            <div className="section-head">
              <h2 id="pairs-title">Pairings</h2>
              <p className="small muted">Fit is scored out of 100 from shared goals, skills, school, communities and free time.</p>
            </div>
            {live.length === 0 ? (
              <div className="empty"><h3>No pairings yet</h3><p>No pair was a good enough fit with the current alumni and their capacity.</p></div>
            ) : (
              <div className="pairings">
                {live.map((m) => {
                  const s = S(m.studentId);
                  const mt = M(m.mentorId);
                  const top = topReasons(s, mt, 1)[0];
                  return (
                    <article key={m.id} className="pairing" aria-label={`${s.name} and ${mt.name}`}>
                      <Thread
                        score={m.score}
                        left={<Person id={s.id} name={s.name} meta={shortSchool(s.school)} />}
                        right={<Person id={mt.id} name={mt.name} meta={mt.headline.replace(/,.*$/, "")} />}
                      />
                      <p className="why">{top?.reason}</p>
                      <div className="end">
                        <StageTag stage={m.stage} />
                        <Link href={`/matches/${m.id}`} className="small">Open match</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="unmatched-title" className="section">
            <div className="section-head">
              <h2 id="unmatched-title">Not matched this round</h2>
              <p className="small muted">We’d rather say so than pair someone badly.</p>
            </div>
            {run.unmatched.length === 0 ? (
              <p>Every participating student has a suggested mentor.</p>
            ) : (
              <div className="grid-2">
                {run.unmatched.map((u) => {
                  const s = state.students.find((x) => x.id === u.studentId);
                  if (!s) return null;
                  return (
                    <div key={u.studentId} className="card stack" style={{ ["--stack" as string]: "12px" }}>
                      <Person id={s.id} name={s.name} meta={s.careerGoals} />
                      <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>{u.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {run.ineligibleMentors.length > 0 && (
              <p className="small muted" style={{ marginTop: 14 }}>
                {run.ineligibleMentors.map((x) => `${M(x.mentorId)?.name ?? "One alum"} is ${/paused/i.test(x.reason) ? "paused this term" : "not taking students right now"}`).join(". ")}.
              </p>
            )}
          </section>

          <Insights />

          <section className="section grid-2" aria-label="Alumni places">
            <PeopleList
              title="Alumni places"
              people={state.mentors.map((m) => {
                const used = live.filter((x) => x.mentorId === m.id).length;
                return { id: m.id, name: m.name, meta: mentorEligibility(m) ? undefined : `${used} of ${m.capacity} places filled`, off: mentorEligibility(m), used, cap: m.capacity };
              })}
            />
          </section>
        </>
      )}
      <p className="small muted" style={{ marginTop: 28 }}>
        Pairs need a fit of at least {DEFAULT_THRESHOLD}. <Link href="/how-it-works">How matching works</Link>
      </p>
    </div>
  );
}

function PeopleList({ title, people }: { title: string; people: { id: string; name: string; meta?: string; off: string | null; used?: number; cap?: number }[] }) {
  return (
    <div>
      <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>{title}</h2>
      <ul className="card" style={{ listStyle: "none", margin: 0, padding: "6px 20px" }}>
        {people.map((p, i) => (
          <li key={p.id} className="row-between" style={{ padding: "12px 0", borderTop: i ? "1px solid var(--line)" : 0, flexWrap: "nowrap" }}>
            <div className="person">
              <Avatar id={p.id} name={p.name} size={36} />
              <div>
                <p className="person-name" style={{ fontSize: "1rem" }}>{p.name}</p>
                {p.meta && <p className="person-meta">{p.meta}</p>}
              </div>
            </div>
            {p.off ? (
              <span className="tag tag-neutral">{/paused/i.test(p.off) ? "Paused" : "Not matching"}</span>
            ) : p.cap !== undefined ? (
              <div className="meter" style={{ width: 80, flexShrink: 0 }} aria-hidden="true"><span style={{ width: `${Math.min(100, ((p.used ?? 0) / p.cap) * 100)}%` }} /></div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
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
      <div className="grid-2">
        {seats.map((x) => {
          const m = mentor(x.mentorId);
          if (!m) return null;
          return (
            <div key={x.mentorId} className="card stack" style={{ ["--stack" as string]: "12px" }}>
              <Person id={m.id} name={m.name} meta={`Takes ${m.capacity} now`} />
              <p style={{ margin: 0 }}>
                One more place with {first(m.name)} would match <strong>{list(x.newlyMatched.map(name))}</strong> and raise the cohort’s total fit by {x.gain}.
              </p>
            </div>
          );
        })}
        {gaps.map((g) => (
          <div key={g.studentId} className="card-sunk stack" style={{ ["--stack" as string]: "8px" }}>
            <h3 style={{ fontSize: "1.1rem" }}>No alum covers {list(g.directions).toLowerCase()}</h3>
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              {name(g.studentId)} is aiming for this, and none of the current alumni have worked in it. Recruiting one would give {name(g.studentId)} a real option.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
