"use client";

import Link from "next/link";
import { roleLabel, useApp } from "@/lib/store";
import { Loading, StageTag } from "@/components/bits";
import { Person, Thread, shortSchool } from "@/components/People";
import { inboxFor } from "@/domain/inbox";

export default function MatchesPage() {
  const { state, ready, role } = useApp();
  if (!ready) return <Loading />;
  const mine = state.matches.filter((m) =>
    role.kind === "coordinator" ? true : role.kind === "student" ? m.studentId === role.id : m.mentorId === role.id,
  );
  const inbox = inboxFor(state, role);
  const S = (id: string) => state.students.find((s) => s.id === id);
  const M = (id: string) => state.mentors.find((m) => m.id === id);
  const who = role.kind === "coordinator" ? "the coordinator" : roleLabel(state, role).split(" ")[0];

  return (
    <div className="page">
      <header className="page-head">
        <h1>{inbox.length ? `${inbox.length} thing${inbox.length > 1 ? "s" : ""} waiting on ${role.kind === "coordinator" ? "you" : who}` : `Nothing waiting on ${who}`}</h1>
        <p className="lede">{role.kind === "coordinator" ? "Every match in the cohort, and what needs you next." : `Matches for ${roleLabel(state, role)}.`}</p>
      </header>

      {inbox.length > 0 && (
        <section aria-labelledby="inbox-title" style={{ marginBottom: 48 }}>
          <h2 id="inbox-title" className="sr-only">Waiting on you</h2>
          <ol className="todo">
            {inbox.map((i, n) => (
              <li key={i.key} data-next={n === 0}>
                <span className="mark" aria-hidden="true">{n + 1}</span>
                <p style={{ fontSize: "0.98rem", color: "var(--ink)" }}>{i.text}</p>
                <Link className={`btn btn-small ${n === 0 ? "" : "btn-secondary"}`} href={i.href}>Open<span className="sr-only">: {i.text}</span></Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="all-title">
        <h2 id="all-title" style={{ marginBottom: 16 }}>{role.kind === "coordinator" ? "All matches" : "Your matches"}</h2>
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
            <Link className="btn btn-secondary" href="/cohort">Go to the cohort</Link>
          </div>
        ) : (
          <div className="pairings">
            {mine.map((m) => {
              const s = S(m.studentId);
              const mt = M(m.mentorId);
              if (!s || !mt) return null;
              return (
                <article key={m.id} className="pairing" aria-label={`${s.name} and ${mt.name}`} style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr) auto" }}>
                  <Thread score={m.score} left={<Person id={s.id} name={s.name} meta={shortSchool(s.school)} />} right={<Person id={mt.id} name={mt.name} meta={mt.headline.replace(/,.*$/, "")} />} />
                  <StageTag stage={m.stage} />
                  <Link className="btn btn-small btn-secondary" href={`/matches/${m.id}`}>
                    Open<span className="sr-only"> match between {s.name} and {mt.name}</span>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
