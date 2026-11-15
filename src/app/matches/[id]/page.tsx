"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { Fictional, Loading, ScoreBreakdown, StageTag, first, fmtDateTime } from "@/components/bits";
import { ActionCard } from "@/components/ActionCard";
import { sharedSlots, slotLabel } from "@/domain/compatibility";
import { MILESTONE_LABEL } from "@/domain/milestones";
import { bilateralValid, confirmMeetingHeld, decideMatch, planAction, toggleMilestone } from "@/domain/workflow";
import type { Match, MentorProfile, Slot, StudentProfile } from "@/domain/types";

const TRACK: { key: string; label: string; reached: (m: Match) => boolean }[] = [
  { key: "proposed", label: "Proposed", reached: () => true },
  { key: "approved", label: "Both approved", reached: (m) => ["approved", "introduced", "meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "introduced", label: "Introduced", reached: (m) => ["introduced", "meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "scheduled", label: "Meeting set", reached: (m) => ["meeting_scheduled", "meeting_held"].includes(m.stage) },
  { key: "held", label: "Meeting held", reached: (m) => m.stage === "meeting_held" },
  { key: "progress", label: "Milestones", reached: (m) => m.milestones.some((x) => x.done) },
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
          <h3>This match doesn’t exist in this browser</h3>
          <p>It may have been replaced by a newer allocation, or the demo was reset.</p>
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
        <p className="eyebrow">
          <Link href="/matches" style={{ color: "inherit" }}>Matches</Link> / {first(s.name)} &amp; {first(m.name)}
        </p>
        <div className="pair" style={{ marginBottom: 20 }}>
          <PersonHead p={s} />
          <span className="amp" aria-hidden="true">&amp;</span>
          <PersonHead p={m} />
        </div>
        <div className="row" style={{ marginBottom: 18 }}>
          <StageTag stage={match.stage} />
          <span className="small muted num">Heuristic score {match.score} / 100</span>
          <Fictional />
        </div>
        {!["declined", "revoked"].includes(match.stage) && (
          <ol className="stage-track" aria-label="Relationship progress">
            {TRACK.map((t, i) => (
              <li key={t.key} data-state={i < currentIdx ? "done" : i === currentIdx ? "current" : "todo"} aria-current={i === currentIdx ? "step" : undefined}>
                {t.label}
              </li>
            ))}
          </ol>
        )}
      </header>

      {match.stage === "revoked" && (
        <p className="notice notice-error" role="alert" style={{ marginBottom: 32 }}>
          A participant withdrew consent, so this match was revoked and every pending message was cancelled. Earlier approvals can’t authorize anything new.
        </p>
      )}
      {match.stage === "declined" && (
        <p className="notice notice-warn" style={{ marginBottom: 32 }}>
          This match was declined. Nothing was sent, and the allocator won’t propose this pair again.
        </p>
      )}

      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "44px" }}>
          <section aria-labelledby="approve-title">
            <h2 id="approve-title" style={{ marginBottom: 6 }}>Both sides decide</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Approving a match lets the coordinator draft an introduction. It doesn’t approve sending anything.
            </p>
            <div className="grid-2">
              <DecisionPanel who="Student" person={s} decision={match.student} canAct={match.stage === "proposed" && role.kind === "student" && role.id === s.id}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "student", actorId(role), d), d === "approved" ? "You approved this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "student", id: s.id })} open={match.stage === "proposed"} />
              <DecisionPanel who="Mentor" person={m} decision={match.mentor} canAct={match.stage === "proposed" && role.kind === "mentor" && role.id === m.id}
                onAct={(d) => apply((st) => decideMatch(st, match.id, "mentor", actorId(role), d), d === "approved" ? "You approved this match." : "You declined this match.")}
                onSwitch={() => setRole({ kind: "mentor", id: m.id })} open={match.stage === "proposed"} />
            </div>
          </section>

          {(actions.length > 0 || active) && (
            <section aria-labelledby="coord-title" className="stack" style={{ ["--stack" as string]: "28px" }}>
              <div>
                <h2 id="coord-title" style={{ marginBottom: 6 }}>Coordination</h2>
                <p className="muted small" style={{ margin: 0 }}>
                  Plan → approve → act → observe. Nothing runs in the background, and every outgoing message or invite needs explicit approval of its exact content.
                  Email and calendar are <strong>simulated</strong>: no real messages are sent and no calendars are connected.
                </p>
              </div>
              {actions.map((a) => (
                <ActionCard key={a.id} action={a} approverName={a.requiredApprover === "student" ? s.name : a.requiredApprover === "mentor" ? m.name : "Program coordinator"} />
              ))}

              {active && introDone && !calendarLive && (
                <div className="panel stack">
                  <h3>Plan the first meeting</h3>
                  <fieldset>
                    <legend className="small">
                      {shared.length ? `Times you’re both usually free (${shared.length})` : "No overlapping times — choose one of the student’s times and confirm with the mentor"}
                    </legend>
                    <div className="row" style={{ marginTop: 8 }}>
                      {slotOptions.map((x) => (
                        <label key={x} className="small row" style={{ gap: 6, border: "1px solid var(--rule)", padding: "8px 12px", background: slot === x ? "var(--cardinal-wash)" : "var(--paper)" }}>
                          <input type="radio" name="slot" checked={slot === x} onChange={() => setSlot(x)} />
                          {slotLabel(x)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="row">
                    <button className="btn btn-small" disabled={!slot} onClick={() => slot && apply((st) => planAction(st, match.id, "calendar_invite", undefined, slot), "Calendar invitation drafted. It needs the student’s approval.")}>
                      Draft calendar invitation
                    </button>
                    <span className="small muted">The student approves the invitation before it’s created.</span>
                  </div>
                </div>
              )}

              {active && match.stage === "meeting_scheduled" && match.meeting && (
                <div className="panel stack">
                  <h3>Did the first conversation happen?</h3>
                  <p className="small" style={{ margin: 0 }}>Scheduled for {match.meeting.startsAt}. Either participant can confirm.</p>
                  {isParticipant ? (
                    <button className="btn btn-small" onClick={() => apply((st) => confirmMeetingHeld(st, match.id, actorId(role)), "First meeting confirmed. Milestones are now unlocked.")}>
                      Confirm the meeting was held
                    </button>
                  ) : (
                    <button className="btn btn-small btn-secondary" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {s.name} to confirm</button>
                  )}
                </div>
              )}

              {active && match.stage === "meeting_held" && !followLive && (
                <div className="panel stack">
                  <h3>Send a thank-you and next step</h3>
                  <p className="small" style={{ margin: 0 }}>Drafts a short follow-up from {first(s.name)} that mentions completed milestones. {first(s.name)} approves it first.</p>
                  <button className="btn btn-small btn-secondary" onClick={() => apply((st) => planAction(st, match.id, "follow_up_email"), "Follow-up drafted for the student’s review.")}>
                    Draft follow-up to {first(m.name)}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="stack" style={{ ["--stack" as string]: "32px" }}>
          <section aria-labelledby="why-title" className="panel">
            <h2 id="why-title" style={{ fontSize: "1.3rem", marginBottom: 10 }}>Why this match</h2>
            <ScoreBreakdown student={s} mentor={m} />
          </section>

          {match.prep.length > 0 && (
            <section aria-labelledby="prep-title">
              <h2 id="prep-title" style={{ fontSize: "1.3rem", marginBottom: 4 }}>Before the first conversation</h2>
              <p className="tiny muted" style={{ marginBottom: 10 }}>{MILESTONE_LABEL}</p>
              <ol className="small" style={{ paddingLeft: 20, margin: 0 }}>
                {match.prep.map((p) => <li key={p} style={{ marginBottom: 8 }}>{p}</li>)}
              </ol>
            </section>
          )}

          {match.milestones.length > 0 && (
            <section aria-labelledby="ms-title">
              <div className="row-between">
                <h2 id="ms-title" style={{ fontSize: "1.3rem" }}>Milestones</h2>
                <span className="small num muted">{match.milestones.filter((x) => x.done).length} of {match.milestones.length} done</span>
              </div>
              <p className="tiny muted" style={{ margin: "4px 0 6px" }}>{MILESTONE_LABEL}</p>
              {match.stage !== "meeting_held" && <p className="small notice" style={{ margin: "0 0 8px" }}>Unlocks after the first meeting is confirmed.</p>}
              {match.stage === "meeting_held" && !isStudent && <p className="small notice" style={{ margin: "0 0 8px" }}>Only {s.name} can check these off. <button className="linklike" onClick={() => setRole({ kind: "student", id: s.id })}>Switch to {first(s.name)}</button></p>}
              <ul className="milestones">
                {match.milestones.map((x) => (
                  <li key={x.id}>
                    <input type="checkbox" id={x.id} checked={x.done} disabled={match.stage !== "meeting_held" || !isStudent || !active}
                      onChange={() => apply((st) => toggleMilestone(st, match.id, x.id, actorId(role)), x.done ? "Milestone reopened." : "Milestone completed.")} />
                    <div>
                      <label htmlFor={x.id} className={x.done ? "done-title" : ""} style={{ fontWeight: 600, display: "block" }}>{x.title}</label>
                      <p className="small" style={{ margin: "2px 0 4px", color: "var(--ink-2)" }}>{x.detail}</p>
                      <p className="tiny muted" style={{ margin: 0 }}>Based on: {x.basis}{x.completedAt && ` · done ${fmtDateTime(x.completedAt)}`}</p>
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

function PersonHead({ p }: { p: StudentProfile | MentorProfile }) {
  return (
    <div>
      <p className="tiny muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{p.kind === "student" ? "Student" : "Alumni mentor"}</p>
      <h1 style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)" }}>{p.name}</h1>
      <p className="person-meta" style={{ margin: "4px 0 0" }}>
        {p.kind === "student" ? `${p.program} · ${p.school} · ’${String(p.gradYear).slice(2)}` : `${p.headline} · ${p.school} ’${String(p.gradYear).slice(2)}`}
      </p>
    </div>
  );
}

function DecisionPanel({ who, person, decision, canAct, onAct, onSwitch, open }: { who: string; person: StudentProfile | MentorProfile; decision: Match["student"]; canAct: boolean; onAct: (d: "approved" | "declined") => void; onSwitch: () => void; open: boolean }) {
  const tag = decision.decision === "approved" ? ["Approved", "tag-ok"] : decision.decision === "declined" ? ["Declined", "tag-bad"] : ["Pending", "tag-wait"];
  return (
    <div className="panel stack" style={{ ["--stack" as string]: "10px" }}>
      <div className="row-between">
        <span className="small muted" style={{ fontWeight: 600 }}>{who}</span>
        <span className={`tag ${tag[1]}`}>{tag[0]}</span>
      </div>
      <p className="person-name" style={{ margin: 0 }}>{person.name}</p>
      {person.kind === "student" ? (
        <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>{person.careerGoals}</p>
      ) : (
        <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>{person.mentoringPreferences}</p>
      )}
      {decision.at && <p className="tiny muted" style={{ margin: 0 }}>Decided {fmtDateTime(decision.at)}</p>}
      {open && decision.decision === "pending" &&
        (canAct ? (
          <div className="row">
            <button className="btn btn-small" onClick={() => onAct("approved")}>Approve match</button>
            <button className="btn btn-small btn-danger" onClick={() => onAct("declined")}>Decline</button>
          </div>
        ) : (
          <button className="btn btn-small btn-secondary" onClick={onSwitch}>View as {first(person.name)} to decide</button>
        ))}
    </div>
  );
}

