"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { Fictional, Loading, ScoreBreakdown, StageTag, first, fmtDateTime } from "@/components/bits";
import { Person, Thread, shortSchool } from "@/components/People";
import { ActionCard } from "@/components/ActionCard";
import { sharedSlots, slotLabel } from "@/domain/compatibility";
import { bilateralValid, confirmMeetingHeld, decideMatch, planAction, toggleMilestone } from "@/domain/workflow";
import type { Match, MentorProfile, StudentProfile } from "@/domain/types";
import type { Slot } from "@/domain/types";

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
      <p className="small" style={{ margin: "28px 0 0" }}><Link href="/matches">All matches</Link></p>
      <section className="match-hero" aria-label={`${s.name} and ${m.name}`}>
        <Thread
            size={64}
          className="stack-sm"
          score={match.score}
          left={<Person id={s.id} name={s.name} meta={`${s.program}, ${shortSchool(s.school)} ’${String(s.gradYear).slice(2)}`} size={64} />}
          right={<Person id={m.id} name={m.name} meta={`${m.headline.replace(/ \(fictional\)/, "")}, ${shortSchool(m.school)} ’${String(m.gradYear).slice(2)}`} size={64} />}
        />
        <h1 className="sr-only">{s.name} and {m.name}</h1>
        <div className="row" style={{ marginTop: 22, gap: 16 }}>
          <StageTag stage={match.stage} />
          <Fictional />
        </div>
        {!["declined", "revoked"].includes(match.stage) && (
          <ol className="journey-track" aria-label="Progress">
            {TRACK.map((t, i) => (
              <li key={t.key} data-state={i < currentIdx ? "done" : i === currentIdx ? "current" : "todo"} aria-current={i === currentIdx ? "step" : undefined}>{t.label}</li>
            ))}
          </ol>
        )}
      </section>

      {match.stage === "revoked" && <p className="notice notice-error" role="alert" style={{ marginBottom: 28 }}>Someone withdrew consent, so this match ended and anything waiting to be sent was cancelled.</p>}
      {match.stage === "declined" && <p className="notice notice-warn" style={{ marginBottom: 28 }}>This match was declined. Nothing was sent, and this pair won’t be suggested again.</p>}

      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "48px" }}>
          <section aria-labelledby="approve-title">
            <h2 id="approve-title" style={{ marginBottom: 6 }}>Both need to say yes</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>Saying yes lets the coordinator draft an introduction. Nothing is sent yet.</p>
            <div className="grid-2">
              <DecisionCard who="Student" person={s} decision={match.student} open={match.stage === "proposed"} canAct={match.stage === "proposed" && isStudent}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "student", actorId(role), d), d === "approved" ? "You said yes to this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "student", id: s.id })} />
              <DecisionCard who="Alum" person={m} decision={match.mentor} open={match.stage === "proposed"} canAct={match.stage === "proposed" && role.kind === "mentor" && role.id === m.id}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "mentor", actorId(role), d), d === "approved" ? "You said yes to this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "mentor", id: m.id })} />
            </div>
          </section>

          {(actions.length > 0 || active) && (
            <section aria-labelledby="coord-title" className="stack" style={{ ["--stack" as string]: "16px" }}>
              <div>
                <h2 id="coord-title" style={{ marginBottom: 6 }}>Coordination</h2>
                <p className="muted small" style={{ margin: 0 }}>
                  Every message and invitation is approved word for word before it goes out. In this demo they’re recorded, not actually sent.
                </p>
              </div>
              {actions.map((a) => (
                <ActionCard key={a.id} action={a} approverName={a.requiredApprover === "student" ? s.name : a.requiredApprover === "mentor" ? m.name : "Program coordinator"} />
              ))}

              {active && introDone && !calendarLive && (
                <div className="card stack" style={{ ["--stack" as string]: "14px" }}>
                  <h3>Plan the first meeting</h3>
                  <fieldset>
                    <legend className="small" style={{ fontWeight: 500, color: "var(--ink-2)" }}>
                      {shared.length ? `Times you’re both usually free` : `No shared times, so here are ${first(s.name)}’s. Check with ${first(m.name)} first.`}
                    </legend>
                    <div className="row" style={{ marginTop: 10, gap: 8 }}>
                      {slotOptions.map((x) => (
                        <label key={x} className="choice" style={{ padding: "8px 14px", gridTemplateColumns: "20px auto" }}>
                          <input type="radio" name="slot" checked={slot === x} onChange={() => setSlot(x)} aria-label={slotLabel(x)} />
                          <span className="small">{slotLabel(x)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <button className="btn btn-small" disabled={!slot} onClick={() => slot && apply((st) => planAction(st, match.id, "calendar_invite", undefined, slot), `Invitation drafted. ${first(s.name)} approves it next.`)}>
                      Draft calendar invitation
                    </button>
                  </div>
                </div>
              )}

              {active && match.stage === "meeting_scheduled" && match.meeting && (
                <div className="card stack" style={{ ["--stack" as string]: "12px" }}>
                  <h3>Did the first conversation happen?</h3>
                  <p className="small" style={{ margin: 0 }}>It was set for {match.meeting.startsAt}. Either of you can confirm.</p>
                  <div>
                    {isParticipant ? (
                      <button className="btn btn-small" onClick={() => apply((st) => confirmMeetingHeld(st, match.id, actorId(role)), "Meeting confirmed. Milestones are ready.")}>Confirm the meeting was held</button>
                    ) : (
                      <button className="btn btn-small btn-secondary" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {first(s.name)}’s account</button>
                    )}
                  </div>
                </div>
              )}

              {active && match.stage === "meeting_held" && !followLive && (
                <div className="card stack" style={{ ["--stack" as string]: "12px" }}>
                  <h3>Say thanks and share what’s next</h3>
                  <p className="small" style={{ margin: 0 }}>A short note from {first(s.name)} that mentions finished milestones. {first(s.name)} reads it before it goes.</p>
                  <div>
                    <button className="btn btn-small btn-secondary" onClick={() => apply((st) => planAction(st, match.id, "follow_up_email"), "Follow-up drafted for review.")}>Draft follow-up to {first(m.name)}</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="stack" style={{ ["--stack" as string]: "40px" }}>
          <section aria-labelledby="why-title" className="card">
            <h2 id="why-title" style={{ fontSize: "1.3rem", marginBottom: 6 }}>Why they fit</h2>
            <ScoreBreakdown student={s} mentor={m} />
          </section>

          {match.prep.length > 0 && (
            <section aria-labelledby="prep-title">
              <h2 id="prep-title" style={{ fontSize: "1.3rem", marginBottom: 4 }}>Before you meet</h2>
              <p className="tiny muted" style={{ marginBottom: 12 }}>Suggestions built from your goals and {first(m.name)}’s path. Written by templates, not AI.</p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                {match.prep.map((p) => <li key={p} className="small" style={{ marginBottom: 10, color: "var(--ink-2)" }}>{p}</li>)}
              </ul>
            </section>
          )}

          {match.milestones.length > 0 && (
            <section aria-labelledby="ms-title">
              <div className="row-between" style={{ marginBottom: 4 }}>
                <h2 id="ms-title" style={{ fontSize: "1.3rem" }}>Milestones</h2>
                <span className="small num muted">{match.milestones.filter((x) => x.done).length} of {match.milestones.length} done</span>
              </div>
              <p className="tiny muted" style={{ marginBottom: 12 }}>From {first(s.name)}’s goals. Written by templates, not AI.</p>
              {match.stage !== "meeting_held" && <p className="notice small" style={{ marginBottom: 10 }}>These open up after the first meeting.</p>}
              {match.stage === "meeting_held" && !isStudent && (
                <p className="notice small" style={{ marginBottom: 10 }}>
                  Only {first(s.name)} can tick these off. <button className="linklike" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {first(s.name)}’s account</button>
                </p>
              )}
              <ul className="milestones">
                {match.milestones.map((x) => (
                  <li key={x.id} data-done={x.done}>
                    <input type="checkbox" id={x.id} checked={x.done} disabled={match.stage !== "meeting_held" || !isStudent || !active}
                      onChange={() => apply((st) => toggleMilestone(st, match.id, x.id, actorId(role)), x.done ? "Milestone reopened." : "Milestone done.")} />
                    <div>
                      <label htmlFor={x.id}>{x.title}</label>
                      <p className="small" style={{ margin: "4px 0", color: "var(--ink-2)" }}>{x.detail}</p>
                      <p className="tiny muted" style={{ margin: 0 }}>{x.completedAt ? `Done ${fmtDateTime(x.completedAt)}` : `Because of: ${x.basis.toLowerCase()}`}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DecisionCard({ who, person, decision, canAct, onAct, onSwitch, open }: { who: string; person: StudentProfile | MentorProfile; decision: Match["student"]; canAct: boolean; onAct: (d: "approved" | "declined") => void; onSwitch: () => void; open: boolean }) {
  const [label, cls] = decision.decision === "approved" ? ["Approved", "tag-ok"] : decision.decision === "declined" ? ["Declined", "tag-bad"] : ["Hasn’t decided", "tag-wait"];
  return (
    <div className="card stack" style={{ ["--stack" as string]: "12px" }}>
      <div className="row-between">
        <span className="small muted">{who}</span>
        <span className={`tag ${cls}`}>{label}</span>
      </div>
      <p className="person-name">{person.name}</p>
      <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
        {person.kind === "student" ? `“${person.careerGoals}”` : `“${person.mentoringPreferences}”`}
      </p>
      {decision.at && <p className="tiny muted" style={{ margin: 0 }}>Decided {fmtDateTime(decision.at)}</p>}
      {open && decision.decision === "pending" &&
        (canAct ? (
          <div className="row">
            <button className="btn btn-small" onClick={() => onAct("approved")}>Approve match</button>
            <button className="btn btn-small btn-danger" onClick={() => onAct("declined")}>Decline</button>
          </div>
        ) : (
          <div><button className="btn btn-small btn-secondary" onClick={onSwitch}>Switch to {first(person.name)}’s account</button></div>
        ))}
    </div>
  );
}
