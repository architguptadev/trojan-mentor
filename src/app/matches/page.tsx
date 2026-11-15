"use client";

import Link from "next/link";
import { roleLabel, useApp } from "@/lib/store";
import { Loading, StageTag } from "@/components/bits";
import { Person, shortSchool } from "@/components/People";

export default function MatchesPage() {
  const { state, ready, role } = useApp();
  if (!ready) return <Loading />;
  const mine = state.matches.filter((m) => (role.kind === "coordinator" ? true : role.kind === "student" ? m.studentId === role.id : m.mentorId === role.id));
  const S = (id: string) => state.students.find((s) => s.id === id);
  const M = (id: string) => state.mentors.find((m) => m.id === id);

  return (
    <div className="page">
      <header className="page-head">
        <span className="kicker">Matches</span>
        <h1>{role.kind === "coordinator" ? "Every match in the cohort" : `Matches for ${roleLabel(state, role)}`}</h1>
        <p className="lede">Open a match to approve it, coordinate the first meeting and track progress.</p>
      </header>
      {mine.length === 0 ? (
        <div className="empty">
          <h3>No matches yet</h3>
          <p>
            {state.allocationRuns.length === 0
              ? "The cohort hasn’t been matched yet."
              : role.kind === "coordinator"
                ? "The last round didn’t suggest any pairs."
                : "The last round didn’t find a good match here. The cohort page explains why."}
          </p>
          <Link className="btn btn-secondary" href={role.kind === "coordinator" ? "/cohort" : "/home"}>{role.kind === "coordinator" ? "Go to the cohort" : "Back to home"}</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Matches</caption>
            <thead><tr><th scope="col">Student</th><th scope="col">Mentor</th><th scope="col" className="num">Fit</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {mine.map((m) => {
                const s = S(m.studentId);
                const mt = M(m.mentorId);
                if (!s || !mt) return null;
                return (
                  <tr key={m.id}>
                    <td style={{ minWidth: 170 }}><Person id={s.id} name={s.name} meta={shortSchool(s.school)} /></td>
                    <td style={{ minWidth: 170 }}><Person id={mt.id} name={mt.name} meta={mt.headline.replace(/,.*$/, "")} /></td>
                    <td className="num serif" style={{ fontSize: "1.15rem" }}>{m.score}</td>
                    <td style={{ minWidth: 160 }}><StageTag stage={m.stage} /></td>
                    <td className="num"><Link href={`/matches/${m.id}`}>Open<span className="sr-only"> match between {s.name} and {mt.name}</span></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
