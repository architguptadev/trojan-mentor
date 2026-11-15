"use client";

import Link from "next/link";
import { roleLabel, useApp } from "@/lib/store";
import { Loading, StageTag } from "@/components/bits";

export default function MatchesPage() {
  const { state, ready, role } = useApp();
  if (!ready) return <Loading />;
  const mine = state.matches.filter((m) =>
    role.kind === "coordinator" ? true : role.kind === "student" ? m.studentId === role.id : m.mentorId === role.id,
  );
  const S = (id: string) => state.students.find((s) => s.id === id);
  const M = (id: string) => state.mentors.find((m) => m.id === id);
  const needsMe = (m: (typeof mine)[number]) =>
    m.stage === "proposed" && ((role.kind === "student" && m.student.decision === "pending") || (role.kind === "mentor" && m.mentor.decision === "pending"));

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Matches</p>
        <h1>{role.kind === "coordinator" ? "Every match in the cohort" : `Matches for ${roleLabel(state, role)}`}</h1>
        <p className="lede">Open a match to approve it, coordinate the first meeting and track progress.</p>
      </header>
      {mine.length === 0 ? (
        <div className="empty">
          <h3>No matches here yet</h3>
          <p>
            {state.allocationRuns.length === 0
              ? "The cohort hasn’t been allocated. A coordinator runs allocation to propose pairs."
              : role.kind === "coordinator"
                ? "The last allocation didn’t propose any pairs."
                : "The last allocation didn’t propose a match for this person. The cohort page explains why."}
          </p>
          <Link className="btn btn-secondary" href="/cohort">Go to the cohort</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Matches</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Mentor</th>
                <th scope="col">Score</th>
                <th scope="col">Stage</th>
                <th scope="col"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m) => (
                <tr key={m.id}>
                  <td style={{ minWidth: 150 }}><span className="serif">{S(m.studentId)?.name}</span></td>
                  <td style={{ minWidth: 150 }}><span className="serif">{M(m.mentorId)?.name}</span></td>
                  <td className="num">{m.score}</td>
                  <td style={{ minWidth: 170 }}>
                    <StageTag stage={m.stage} />
                    {needsMe(m) && <div className="small" style={{ color: "var(--cardinal)", marginTop: 4, fontWeight: 600 }}>Needs your decision</div>}
                  </td>
                  <td><Link href={`/matches/${m.id}`}>Open<span className="sr-only"> match between {S(m.studentId)?.name} and {M(m.mentorId)?.name}</span> →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
