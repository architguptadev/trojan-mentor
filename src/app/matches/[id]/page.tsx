"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { Fictional, Loading, ScoreBreakdown, StageTag, first, fmtDateTime } from "@/components/bits";
import { Avatar, shortSchool } from "@/components/People";
import { ActionCard } from "@/components/ActionCard";
import { sharedSlots, slotLabel } from "@/domain/compatibility";
import { bilateralValid, confirmMeetingHeld, decideMatch, planAction, toggleMilestone } from "@/domain/workflow";
import type { Match, MentorProfile, Slot, StudentProfile } from "@/domain/types";

const TRACK: { key: string; label: string; reached: (m: Match) => boolean }[] = [
  { key: "proposed", label: "Suggested", reached: () => true },
  { key: "approved", label: "Both said yes", reached: (m) => ["approved", "introduced", "meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "introduced", label: "Introduced", reached: (m) => ["introduced", "meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "scheduled", label: "Meeting set", reached: (m) => ["meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "held", label: "Met", reached: (m) => m.stage === "meeting_held" },
  { key: "progress", label: "Making progress", reached: (m) => m.milestones.some((x) => x.done) },
];

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const { state, ready, role, setRole, apply } = useApp();
  const [slot, setSlot] = useState<Slot | "">("");
  if (!ready) return <Loading />;
  const match = state.matches.find((m) => m.id === decodeURIComponent(params.id));
  if (!match)
    return (
      <div className="page">
        <div className="empty" style={{ marginTop: 48 }}>
          <h3>We can’t find this match</h3>
          <p>A newer allocation may have replaced it, or the demo was reset.</p>
          <Link className="btn btn-secondary" href="/matches">See all matches</Link>
        </div>
      </div>
    );
  const s = state.students.find((x) => x.id === match.studentId)!;
  const m = state.mentors.find((x) => x.id === match.mentorId)!;
  const actions = state.actions.filter((a) => a.matchId === match.id);
  const active = bilateralValid(state, match);
  const shared = sharedSlots(s.availability, m.availability);
  const slotOptions = shared.length ? shared : s.availability;
  const introDone = actions.some((a) => a.kind === "introduction_email" && a.status === "succeeded");
  const calendarLive = actions.some((a) => a.kind === "calendar_invite" && a.status !== "cancelled");
  const followLive = actions.some((a) => a.kind === "follow_up_email" && !["succeeded", "cancelled"].includes(a.status));
  const isStudent = role.kind === "student" && role.id === s.id;
  const isParticipant = isStudent || (role.kind === "mentor" && role.id === m.id);
  const currentIdx = TRACK.reduce((acc, t, i) => (t.reached(match) ? i : acc), 0);

  return (
    <div className="page">
      <header className="page-head">
        <Link href="/matches" className="back">← All matches</Link>
        <span className="kicker">Match</span>
        <h1 style={{ marginBottom: 10 }}>{s.name} and {m.name}</h1>
        <p className="small muted" style={{ margin: "0 0 12px" }}>
          {s.program}, {shortSchool(s.school)} ’{String(s.gradYear).slice(2)}. Mentor: {m.headline.replace(/ \(fictional\)/g, "")}, {shortSchool(m.school)} ’{String(m.gradYear).slice(2)}.
        </p>
        <div className="row" style={{ gap: 18 }}>
          <StageTag stage={match.stage} />
          <span className="small"><span className="serif num" style={{ fontSize: "1.1rem" }}>{match.score}</span> <span className="muted">/ 100 fit</span></span>
          <Fictional />
        </div>
        {!["declined", "revoked"].includes(match.stage) && (
          <ol className="track" aria-label="Progress">
            {TRACK.map((t, i) => (
              <li key={t.key} data-state={i < currentIdx ? "done" : i === currentIdx ? "current" : "todo"} aria-current={i === currentIdx ? "step" : undefined}>{t.label}</li>
            ))}
          </ol>
        )}
      </header>

      {match.stage === "revoked" && <p className="notice notice-error" role="alert" style={{ marginBottom: 24 }}>Someone withdrew consent, so this match ended and anything waiting to be sent was cancelled.</p>}
      {match.stage === "declined" && <p className="notice notice-warn" style={{ marginBottom: 24 }}>This match was declined. Nothing was sent, and this pair won’t be suggested again.</p>}

      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "44px" }}>
          <section aria-labelledby="approve-title">
            <h2 id="approve-title" style={{ marginBottom: 4 }}>Both need to say yes</h2>
            <p className="small muted" style={{ marginBottom: 14 }}>Saying yes lets the coordinator draft an introduction. Nothing is sent yet.</p>
            <ul className="rows">
              <DecisionRow who="Student" person={s} decision={match.student} open={match.stage === "proposed"} canAct={match.stage === "proposed" && isStudent}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "student", actorId(role), d), d === "approved" ? "You said yes to this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "student", id: s.id })} />
              <DecisionRow who="Alum" person={m} decision={match.mentor} open={match.stage === "proposed"} canAct={match.stage === "proposed" && role.kind === "mentor" && role.id === m.id}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "mentor", actorId(role), d), d === "approved" ? "You said yes to this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "mentor", id: m.id })} />
            </ul>
          </section>

          {(actions.length > 0 || active) && (
            <section aria-labelledby="coord-title" className="stack" style={{ ["--stack" as string]: "18px" }}>
              <div>
                <h2 id="coord-title" style={{ marginBottom: 4 }}>Coordination</h2>
                <p className="small muted" style={{ margin: 0 }}>Every message and invitation is approved word for word before it goes out. In this demo they’re recorded, not actually sent.</p>
              </div>
              {actions.map((a) => (
                <ActionCard key={a.id} action={a} approverName={a.requiredApprover === "student" ? s.name : a.requiredApprover === "mentor" ? m.name : "Program coordinator"} />
              ))}

              {active && introDone && !calendarLive && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>Plan the first meeting</h3>
                  <fieldset>
                    <legend className="small" style={{ fontWeight: 400, color: "var(--ink-2)" }}>
                      {shared.length ? "Times you’re both usually free" : `No shared times, so here are ${first(s.name)}’s. Check with ${first(m.name)} first.`}
                    </legend>
                    <div className="checks" style={{ marginTop: 10 }}>
                      {slotOptions.map((x) => (
                        <label key={x} className="check">
                          <input type="radio" name="slot" checked={slot === x} onChange={() => setSlot(x)} aria-label={slotLabel(x)} style={{ accentColor: "var(--cardinal)" }} />
                          <span>{slotLabel(x)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="actions" style={{ marginTop: 14 }}>
                    <button className="btn btn-small" disabled={!slot} onClick={() => slot && apply((st) => planAction(st, match.id, "calendar_invite", undefined, slot), `Invitation drafted. ${first(s.name)} approves it next.`)}>Draft calendar invitation</button>
                  </div>
                </div>
              )}

              {active && match.stage === "meeting_scheduled" && match.meeting && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <h3 style={{ marginBottom: 6 }}>Did the first conversation happen?</h3>
                  <p className="small" style={{ margin: "0 0 12px" }}>It was set for {match.meeting.startsAt}. Either of you can confirm.</p>
                  {isParticipant ? (
                    <button className="btn btn-small" onClick={() => apply((st) => confirmMeetingHeld(st, match.id, actorId(role)), "Meeting confirmed. Milestones are ready.")}>Confirm the meeting was held</button>
                  ) : (
                    <button className="link small" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {first(s.name)}’s account</button>
                  )}
                </div>
              )}

              {active && match.stage === "meeting_held" && !followLive && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <h3 style={{ marginBottom: 6 }}>Say thanks and share what’s next</h3>
                  <p className="small" style={{ margin: "0 0 12px" }}>A short note from {first(s.name)} that mentions finished milestones. {first(s.name)} reads it before it goes.</p>
                  <button className="btn btn-small btn-secondary" onClick={() => apply((st) => planAction(st, match.id, "follow_up_email"), "Follow-up drafted for review.")}>Draft follow-up to {first(m.name)}</button>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="stack" style={{ ["--stack" as string]: "40px" }}>
          <section aria-labelledby="why-title">
            <h2 id="why-title" className="section-title">Why they fit</h2>
            <div style={{ borderTop: "1px solid var(--line)" }}><ScoreBreakdown student={s} mentor={m} /></div>
          </section>

          {match.prep.length > 0 && (
            <section aria-labelledby="prep-title">
              <h2 id="prep-title" className="section-title">Before you meet</h2>
              <ul className="rows small" style={{ color: "var(--ink-2)" }}>
                {match.prep.map((p) => <li key={p} style={{ padding: "10px 0" }}>{p}</li>)}
              </ul>
              <p className="tiny muted" style={{ marginTop: 8 }}>Written by templates from your goals and {first(m.name)}’s path, not by AI.</p>
            </section>
          )}

          {match.milestones.length > 0 && (
            <section aria-labelledby="ms-title">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h2 id="ms-title" className="section-title" style={{ margin: 0 }}>Milestones</h2>
                <span className="tiny num muted">{match.milestones.filter((x) => x.done).length} of {match.milestones.length} done</span>
              </div>
              {match.stage !== "meeting_held" && <p className="small muted" style={{ marginBottom: 10 }}>These open up after the first meeting.</p>}
              {match.stage === "meeting_held" && !isStudent && (
                <p className="small muted" style={{ marginBottom: 10 }}>Only {first(s.name)} can tick these off. <button className="link" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {first(s.name)}’s account</button></p>
              )}
              <ul className="milestones">
                {match.milestones.map((x) => (
                  <li key={x.id} data-done={x.done}>
                    <input type="checkbox" id={x.id} checked={x.done} disabled={match.stage !== "meeting_held" || !isStudent || !active}
                      onChange={() => apply((st) => toggleMilestone(st, match.id, x.id, actorId(role)), x.done ? "Milestone reopened." : "Milestone done.")} />
                    <div>
                      <label htmlFor={x.id}>{x.title}</label>
                      <p className="small" style={{ margin: "2px 0", color: "var(--ink-2)" }}>{x.detail}</p>
                      <p className="tiny muted" style={{ margin: 0 }}>{x.completedAt ? `Done ${fmtDateTime(x.completedAt)}` : `Because of: ${x.basis.toLowerCase()}`}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="tiny muted" style={{ marginTop: 8 }}>Written by templates from {first(s.name)}’s goals, not by AI.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DecisionRow({ who, person, decision, canAct, onAct, onSwitch, open }: { who: string; person: StudentProfile | MentorProfile; decision: Match["student"]; canAct: boolean; onAct: (d: "approved" | "declined") => void; onSwitch: () => void; open: boolean }) {
  const [label, cls] = decision.decision === "approved" ? ["Approved", "tag-ok"] : decision.decision === "declined" ? ["Declined", "tag-bad"] : ["Hasn’t decided", "tag-wait"];
  return (
    <li style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", gap: "4px 12px", alignItems: "start" }}>
      <Avatar id={person.id} name={person.name} />
      <div>
        <p className="person-name">{person.name} <span className="muted" style={{ fontWeight: 400 }}>· {who}</span></p>
        <p className="small" style={{ margin: "2px 0 0", color: "var(--ink-2)" }}>“{person.kind === "student" ? person.careerGoals : person.mentoringPreferences}”</p>
        {decision.at && <p className="tiny muted" style={{ margin: "4px 0 0" }}>Decided {fmtDateTime(decision.at)}</p>}
        {open && decision.decision === "pending" && (
          <div className="actions" style={{ marginTop: 10, gap: 12 }}>
            {canAct ? (
              <>
                <button className="btn btn-small" onClick={() => onAct("approved")}>Approve match</button>
                <button className="btn btn-small btn-danger" onClick={() => onAct("declined")}>Decline</button>
              </>
            ) : (
              <button className="link small" onClick={onSwitch}>Switch to {first(person.name)}’s account</button>
            )}
          </div>
        )}
      </div>
      <span className={`tag ${cls}`}>{label}</span>
    </li>
  );
}
