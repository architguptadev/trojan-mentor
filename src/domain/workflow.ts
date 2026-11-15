import { firstMeetingPrep, generateMilestones } from "./milestones";
import { sharedSlots, slotLabel } from "./compatibility";
import type {
  ActionKind,
  AppState,
  ApproverRole,
  CalendarDraft,
  Consent,
  CoordinationAction,
  Draft,
  EmailDraft,
  Match,
  MentorProfile,
  OutboxEntry,
  Slot,
  StudentProfile,
} from "./types";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

const now = () => new Date().toISOString();

// ---------- lookups ----------

export function getStudent(state: AppState, id: string): StudentProfile {
  const s = state.students.find((x) => x.id === id);
  if (!s) throw new DomainError(`Unknown student ${id}`);
  return s;
}
export function getMentor(state: AppState, id: string): MentorProfile {
  const m = state.mentors.find((x) => x.id === id);
  if (!m) throw new DomainError(`Unknown mentor ${id}`);
  return m;
}
export function getMatch(state: AppState, id: string): Match {
  const m = state.matches.find((x) => x.id === id);
  if (!m) throw new DomainError(`Unknown match ${id}`);
  return m;
}
export function getAction(state: AppState, id: string): CoordinationAction {
  const a = state.actions.find((x) => x.id === id);
  if (!a) throw new DomainError(`Unknown action ${id}`);
  return a;
}

/** Fictional demo addresses on the reserved example.org domain. Nothing is ever delivered. */
export function demoEmail(p: { id: string; name: string }) {
  const first = p.name.split(" ")[0].toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
  return `${first}.${p.id}@example.org`;
}

function log(state: AppState, message: string, at: string): AppState["auditLog"] {
  return [...state.auditLog, { at, message }];
}

function replaceMatch(state: AppState, match: Match): AppState {
  return { ...state, matches: state.matches.map((m) => (m.id === match.id ? match : m)) };
}
function replaceAction(state: AppState, action: CoordinationAction): AppState {
  return { ...state, actions: state.actions.map((a) => (a.id === action.id ? action : a)) };
}

// ---------- consent ----------

export function consentActive(c: Consent) {
  return c.profileProcessing && c.matching;
}

/**
 * Update a person's consent. Changes to profile processing or matching bump the consent version,
 * which makes every earlier approval stale. Withdrawal also revokes open/approved matches and
 * cancels any pending outgoing action, so a stale approval can never authorize a new action.
 * External-AI consent only governs document interpretation and does not affect matches.
 */
export function updateConsent(
  state: AppState,
  personId: string,
  patch: Partial<Pick<Consent, "profileProcessing" | "externalAI" | "matching">>,
  at = now(),
): AppState {
  const isStudent = state.students.some((s) => s.id === personId);
  const person = isStudent ? getStudent(state, personId) : getMentor(state, personId);
  const before = person.consent;
  const next: Consent = { ...before, ...patch, updatedAt: at };
  const relevantChanged = next.profileProcessing !== before.profileProcessing || next.matching !== before.matching;
  if (relevantChanged) next.version = before.version + 1;
  // Withdrawing profile processing implies withdrawing matching.
  if (!next.profileProcessing) next.matching = false;

  let st: AppState = isStudent
    ? { ...state, students: state.students.map((s) => (s.id === personId ? { ...s, consent: next } : s)) }
    : { ...state, mentors: state.mentors.map((m) => (m.id === personId ? { ...m, consent: next } : m)) };

  const withdrawn = !consentActive(next) && consentActive(before);
  if (withdrawn) {
    const affected = st.matches.filter(
      (m) => (m.studentId === personId || m.mentorId === personId) && !["declined", "revoked"].includes(m.stage),
    );
    for (const m of affected) {
      st = replaceMatch(st, { ...m, stage: "revoked" });
      for (const a of st.actions.filter((a) => a.matchId === m.id && a.status !== "succeeded" && a.status !== "cancelled")) {
        st = replaceAction(st, {
          ...a,
          status: "cancelled",
          approval: undefined,
          history: [...a.history, { at, phase: "observe", message: "Cancelled: a participant withdrew consent. Nothing further will be sent." }],
        });
      }
    }
    st = { ...st, auditLog: log(st, `${person.name} withdrew consent; ${affected.length} match(es) revoked.`, at) };
  } else {
    st = { ...st, auditLog: log(st, `${person.name} updated consent settings.`, at) };
  }
  return st;
}

// ---------- bilateral approval ----------

export type Party = "student" | "mentor";

/** True only if both parties approved under their CURRENT consent and still consent. */
export function bilateralValid(state: AppState, match: Match): boolean {
  if (["proposed", "declined", "revoked"].includes(match.stage)) return false;
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  return (
    match.student.decision === "approved" &&
    match.mentor.decision === "approved" &&
    match.student.consentVersion === s.consent.version &&
    match.mentor.consentVersion === m.consent.version &&
    consentActive(s.consent) &&
    consentActive(m.consent) &&
    m.optIn
  );
}

/**
 * A party approves or declines a proposed match. `actorId` is the simulated signed-in person;
 * only the student may decide for the student side and only the mentor for the mentor side.
 */
export function decideMatch(
  state: AppState,
  matchId: string,
  party: Party,
  actorId: string,
  decision: "approved" | "declined",
  at = now(),
): AppState {
  const match = getMatch(state, matchId);
  if (match.stage !== "proposed") throw new DomainError("This match is no longer open for decisions.");
  const expected = party === "student" ? match.studentId : match.mentorId;
  if (actorId !== expected) throw new DomainError(`Only the ${party} in this match can make this decision.`);
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  const person = party === "student" ? s : m;
  if (!consentActive(person.consent)) throw new DomainError("Consent to processing and matching is required before deciding.");

  let next: Match = {
    ...match,
    [party]: { decision, at, consentVersion: person.consent.version },
  };
  let st = state;
  if (decision === "declined") {
    next = { ...next, stage: "declined" };
    st = { ...st, auditLog: log(st, `${person.name} declined the proposed match. The pair will not be proposed again.`, at) };
    return replaceMatch(st, next);
  }
  st = { ...st, auditLog: log(st, `${person.name} approved the proposed match with ${party === "student" ? m.name : s.name}.`, at) };

  if (next.student.decision === "approved" && next.mentor.decision === "approved") {
    next = {
      ...next,
      stage: "approved",
      prep: firstMeetingPrep(s, m),
      milestones: generateMilestones(s, m, next.id),
    };
    st = replaceMatch(st, next);
    st = { ...st, auditLog: log(st, `Both ${s.name} and ${m.name} approved. Introduction draft prepared for coordinator review.`, at) };
    return planAction(st, next.id, "introduction_email", at);
  }
  return replaceMatch(st, next);
}

// ---------- coordination: plan → approve → act → observe ----------

const REQUIRED_APPROVER: Record<ActionKind, ApproverRole> = {
  introduction_email: "coordinator",
  calendar_invite: "student",
  follow_up_email: "student",
};

export function idempotencyKeyFor(kind: ActionKind, matchId: string, seq = 1) {
  return `${kind}:${matchId}:${seq}`;
}

/** FNV-1a over the canonical JSON of a draft. Used to bind approvals to exact content. */
export function draftHash(d: Draft): string {
  const full = JSON.stringify(d);
  let h = 0x811c9dc5;
  for (let i = 0; i < full.length; i++) {
    h ^= full.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function buildDraft(state: AppState, match: Match, kind: ActionKind, slot?: Slot, at = now()): Draft {
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  const sf = s.name.split(" ")[0];
  const mf = m.name.split(" ")[0];
  if (kind === "introduction_email") {
    const d: EmailDraft = {
      type: "email",
      to: [demoEmail(s), demoEmail(m)],
      subject: `Introduction: ${sf} ${s.name.split(" ").slice(1).join(" ")} and ${mf} — Trojan Mentor`,
      body: [
        `Hi ${sf} and ${mf},`,
        ``,
        `You both approved this mentorship match, so we’re introducing you.`,
        ``,
        `${sf} is studying ${s.program} (${s.school}, class of ${s.gradYear}). Their goal: ${s.careerGoals}`,
        ``,
        `${mf} is ${m.headline}. ${mf}’s mentoring preference: ${m.mentoringPreferences}`,
        ``,
        `Why we suggested this pairing: shared ${matchReasonsShort(state, match)}.`,
        ``,
        `${sf}, please propose a first conversation in one of your overlapping times. You can reply to each other directly.`,
        ``,
        `— Trojan Mentor program coordinator`,
      ].join("\n"),
    };
    return d;
  }
  if (kind === "calendar_invite") {
    if (!slot) throw new DomainError("Choose a time before planning a calendar invite.");
    const d: CalendarDraft = {
      type: "calendar",
      title: `First mentorship conversation: ${sf} & ${mf}`,
      attendees: [demoEmail(s), demoEmail(m)],
      slot,
      startsAt: nextOccurrence(slot, at),
      durationMinutes: 45,
      location: "Video call (link added by the organizer)",
    };
    return d;
  }
  const done = match.milestones.filter((x) => x.done).map((x) => x.title);
  const nextUp = match.milestones.find((x) => !x.done);
  const d: EmailDraft = {
    type: "email",
    to: [demoEmail(m)],
    subject: `Thank you — and my next step`,
    body: [
      `Hi ${mf},`,
      ``,
      `Thank you for our first conversation. ${done.length ? `Since then I’ve finished: ${done.join("; ")}.` : "I’m starting on the plan we discussed."}`,
      nextUp ? `Next, I’m working on: ${nextUp.title}. Could I share it with you when it’s ready?` : `I’d love to set a time for our next check-in.`,
      ``,
      `Best,`,
      sf,
    ].join("\n"),
  };
  return d;
}

function matchReasonsShort(state: AppState, match: Match) {
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  const parts: string[] = [];
  if (s.school === m.school) parts.push(`${s.school}`);
  const comm = s.communities.filter((c) => m.communities.includes(c));
  if (comm.length) parts.push(comm.join(", ").toLowerCase());
  const slots = sharedSlots(s.availability, m.availability);
  if (slots.length) parts.push(`availability (${slots.map(slotLabel).join(", ")})`);
  return parts.length ? `career direction, plus ${parts.join("; ")}` : "career direction";
}

export function planAction(state: AppState, matchId: string, kind: ActionKind, at = now(), slot?: Slot): AppState {
  const match = getMatch(state, matchId);
  if (!bilateralValid(state, match)) throw new DomainError("Both participants must have approved under their current consent first.");
  const seq = state.actions.filter((a) => a.matchId === matchId && a.kind === kind).length + 1;
  const live = state.actions.find(
    (a) => a.matchId === matchId && a.kind === kind && !["succeeded", "cancelled"].includes(a.status),
  );
  if (live) throw new DomainError("An action of this kind is already in progress for this match.");
  if (kind !== "follow_up_email" && state.actions.some((a) => a.matchId === matchId && a.kind === kind && a.status === "succeeded"))
    throw new DomainError("This step has already been completed for this match.");
  const draft = buildDraft(state, match, kind, slot, at);
  const action: CoordinationAction = {
    id: `act-${kind}-${matchId}-${seq}`,
    matchId,
    kind,
    idempotencyKey: idempotencyKeyFor(kind, matchId, seq),
    draft,
    requiredApprover: REQUIRED_APPROVER[kind],
    status: "awaiting_approval",
    attempts: 0,
    history: [{ at, phase: "plan", message: `Planned ${labelForKind(kind)}. Draft is waiting for ${REQUIRED_APPROVER[kind]} approval. Nothing has been sent.` }],
    createdAt: at,
  };
  return { ...state, actions: [...state.actions, action] };
}

export function editDraft(state: AppState, actionId: string, draft: Draft, at = now()): AppState {
  const a = getAction(state, actionId);
  if (!["awaiting_approval", "approved", "failed"].includes(a.status)) throw new DomainError("This draft can no longer be edited.");
  if (draft.type !== a.draft.type) throw new DomainError("Draft type cannot change.");
  const changed = draftHash(draft) !== draftHash(a.draft);
  if (!changed) return state;
  return replaceAction(state, {
    ...a,
    draft,
    status: "awaiting_approval",
    approval: undefined,
    history: [...a.history, { at, phase: "plan", message: a.approval ? "Draft edited after approval — approval cleared; re-approval required." : "Draft edited." }],
  });
}

export function approveAction(state: AppState, actionId: string, role: ApproverRole, actorId: string, at = now()): AppState {
  const a = getAction(state, actionId);
  const match = getMatch(state, a.matchId);
  if (!["awaiting_approval", "failed"].includes(a.status) || (a.status === "failed" && a.approval))
    throw new DomainError("This draft isn’t waiting for approval.");
  if (role !== a.requiredApprover) throw new DomainError(`Only the ${a.requiredApprover} can approve this ${labelForKind(a.kind)}.`);
  if (role === "student" && actorId !== match.studentId) throw new DomainError("Only the student in this match can approve.");
  if (role === "mentor" && actorId !== match.mentorId) throw new DomainError("Only the mentor in this match can approve.");
  if (!bilateralValid(state, match)) throw new DomainError("The match is no longer approved by both participants under current consent.");
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  return replaceAction(state, {
    ...a,
    status: "approved",
    approval: { role, by: actorId, at, draftHash: draftHash(a.draft), consentVersions: { student: s.consent.version, mentor: m.consent.version } },
    history: [...a.history, { at, phase: "approve", message: `Approved exact draft (hash ${draftHash(a.draft)}) as ${role}.` }],
  });
}

/** Why an action cannot execute right now, or null if it can. */
export function executionBlocker(state: AppState, a: CoordinationAction): string | null {
  if (a.status === "succeeded") return "Already completed.";
  if (a.status === "cancelled") return "Cancelled.";
  if (!a.approval) return "Needs approval of the exact draft first.";
  if (a.approval.draftHash !== draftHash(a.draft)) return "Draft changed after approval; re-approve it.";
  const match = getMatch(state, a.matchId);
  const s = getStudent(state, match.studentId);
  const m = getMentor(state, match.mentorId);
  if (a.approval.consentVersions.student !== s.consent.version || a.approval.consentVersions.mentor !== m.consent.version)
    return "Consent changed after approval; this approval is stale.";
  if (!bilateralValid(state, match)) return "The match is no longer approved by both participants.";
  return null;
}

/**
 * Execute an approved action through the SIMULATED adapter. Never touches real email or calendars.
 * Idempotent: the provider ledger (outbox) is keyed by idempotencyKey, so retries after a lost
 * acknowledgement observe the existing delivery instead of sending a duplicate.
 */
export function executeAction(state: AppState, actionId: string, at = now()): AppState {
  const a = getAction(state, actionId);
  const blocker = executionBlocker(state, a);
  if (blocker) throw new DomainError(blocker);

  const attempts = a.attempts + 1;
  const history = [...a.history, { at, phase: "act" as const, message: `Attempt ${attempts}: sent to simulated ${a.draft.type === "email" ? "email" : "calendar"} adapter with key ${a.idempotencyKey}.` }];
  const existing = state.outbox.find((o) => o.idempotencyKey === a.idempotencyKey);
  const failure = state.nextFailure;
  let outbox = state.outbox;
  let st: AppState = { ...state, nextFailure: "none" };

  if (existing) {
    const done: CoordinationAction = {
      ...a,
      attempts,
      status: "succeeded",
      lastError: undefined,
      result: { providerId: existing.providerId, observedAt: at, adapter: "simulated" },
      history: [...history, { at, phase: "observe", message: `Simulated provider already holds key ${a.idempotencyKey} (${existing.providerId}). No duplicate was created.` }],
    };
    return applySuccess(replaceAction(st, done), done, at);
  }

  if (failure === "reject") {
    const failed: CoordinationAction = {
      ...a,
      attempts,
      status: "failed",
      lastError: "Simulated provider error (503). Nothing was delivered.",
      history: [...history, { at, phase: "observe", message: "Failed: simulated provider returned 503. Nothing was delivered. Safe to retry with the same key." }],
    };
    return { ...replaceAction(st, failed), auditLog: log(st, `Simulated delivery failed for ${labelForKind(a.kind)} (attempt ${attempts}).`, at) };
  }

  const providerId = `sim-${a.kind.split("_")[0]}-${hashShort(a.idempotencyKey)}`;
  const entry: OutboxEntry = {
    idempotencyKey: a.idempotencyKey,
    providerId,
    kind: a.kind,
    deliveredAt: at,
    summary: a.draft.type === "email" ? a.draft.subject : `${a.draft.title} — ${a.draft.startsAt}`,
  };
  outbox = [...outbox, entry];
  st = { ...st, outbox };

  if (failure === "lost_ack") {
    const failed: CoordinationAction = {
      ...a,
      attempts,
      status: "failed",
      lastError: "Simulated timeout waiting for acknowledgement. Delivery status unknown.",
      history: [...history, { at, phase: "observe", message: "Timed out waiting for the simulated provider. Delivery status unknown — retrying with the same key is safe." }],
    };
    return { ...replaceAction(st, failed), auditLog: log(st, `Simulated acknowledgement lost for ${labelForKind(a.kind)} (attempt ${attempts}).`, at) };
  }

  const done: CoordinationAction = {
    ...a,
    attempts,
    status: "succeeded",
    lastError: undefined,
    result: { providerId, observedAt: at, adapter: "simulated" },
    history: [...history, { at, phase: "observe", message: `Simulated delivery recorded (${providerId}). No real ${a.draft.type === "email" ? "email was sent" : "calendar was changed"}.` }],
  };
  return applySuccess(replaceAction(st, done), done, at);
}

function applySuccess(state: AppState, a: CoordinationAction, at: string): AppState {
  const match = getMatch(state, a.matchId);
  let st = { ...state, auditLog: log(state, `${labelForKind(a.kind)} recorded by simulated adapter.`, at) };
  if (a.kind === "introduction_email" && match.stage === "approved") {
    st = replaceMatch(st, { ...match, stage: "introduced" });
  }
  if (a.kind === "calendar_invite" && a.draft.type === "calendar" && (match.stage === "introduced" || match.stage === "approved")) {
    st = replaceMatch(st, { ...match, stage: "meeting_scheduled", meeting: { slot: a.draft.slot, startsAt: a.draft.startsAt } });
  }
  return st;
}

export function confirmMeetingHeld(state: AppState, matchId: string, actorId: string, at = now()): AppState {
  const match = getMatch(state, matchId);
  if (match.stage !== "meeting_scheduled" || !match.meeting) throw new DomainError("Schedule the first meeting before confirming it.");
  if (actorId !== match.studentId && actorId !== match.mentorId) throw new DomainError("Only a participant can confirm the meeting.");
  if (!bilateralValid(state, match)) throw new DomainError("The match is no longer approved by both participants.");
  const st = replaceMatch(state, { ...match, stage: "meeting_held", meeting: { ...match.meeting, confirmedHeldAt: at } });
  return { ...st, auditLog: log(st, `First meeting confirmed as held.`, at) };
}

export function toggleMilestone(state: AppState, matchId: string, milestoneId: string, actorId: string, at = now()): AppState {
  const match = getMatch(state, matchId);
  if (actorId !== match.studentId) throw new DomainError("Only the student can update their milestones.");
  if (!bilateralValid(state, match)) throw new DomainError("The match is no longer active.");
  const milestones = match.milestones.map((x) =>
    x.id === milestoneId ? { ...x, done: !x.done, completedAt: !x.done ? at : undefined } : x,
  );
  const ms = milestones.find((x) => x.id === milestoneId);
  if (!ms) throw new DomainError("Unknown milestone.");
  const st = replaceMatch(state, { ...match, milestones });
  return { ...st, auditLog: log(st, `Milestone ${ms.done ? "completed" : "reopened"}: ${ms.title}.`, at) };
}

export function setNextFailure(state: AppState, mode: AppState["nextFailure"]): AppState {
  return { ...state, nextFailure: mode };
}

export function labelForKind(k: ActionKind) {
  return k === "introduction_email" ? "introduction email" : k === "calendar_invite" ? "calendar invite" : "follow-up email";
}

/**
 * Next occurrence of a weekly slot, as a human-readable Pacific-time label.
 * Morning 10:00, afternoon 2:00 PM, evening 6:30 PM. At least 24 h out.
 */
export function nextOccurrence(slot: Slot, fromIso: string): string {
  const [day, part] = slot.split("-") as [string, string];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const target = days.indexOf(day);
  const from = new Date(fromIso);
  // Work in Pacific time using Intl to get today's weekday there.
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(from).map((p) => [p.type, p.value]));
  const today = days.indexOf(parts.weekday);
  let delta = (target - today + 7) % 7;
  if (delta < 1) delta += 7;
  const base = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + delta, 12));
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(base);
  const time = part === "morning" ? "10:00 AM" : part === "afternoon" ? "2:00 PM" : "6:30 PM";
  return `${label}, ${time} PT`;
}

function hashShort(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Delete a person and everything derived from them (matches, drafts, simulated deliveries). */
export function deletePerson(state: AppState, personId: string, at = now()): AppState {
  const matchIds = new Set(state.matches.filter((m) => m.studentId === personId || m.mentorId === personId).map((m) => m.id));
  const actionKeys = new Set(state.actions.filter((a) => matchIds.has(a.matchId)).map((a) => a.idempotencyKey));
  return {
    ...state,
    students: state.students.filter((s) => s.id !== personId).map((s) => ({ ...s, excludeMentorIds: s.excludeMentorIds.filter((x) => x !== personId) })),
    mentors: state.mentors.filter((m) => m.id !== personId).map((m) => ({ ...m, excludeStudentIds: m.excludeStudentIds.filter((x) => x !== personId) })),
    matches: state.matches.filter((m) => !matchIds.has(m.id)),
    actions: state.actions.filter((a) => !matchIds.has(a.matchId)),
    outbox: state.outbox.filter((o) => !actionKeys.has(o.idempotencyKey)),
    allocationRuns: state.allocationRuns.map((r) => ({
      ...r,
      assigned: r.assigned.filter((x) => x.studentId !== personId && x.mentorId !== personId),
      greedyAssigned: r.greedyAssigned.filter((x) => x.studentId !== personId && x.mentorId !== personId),
      unmatched: r.unmatched.filter((x) => x.studentId !== personId),
      ineligibleMentors: r.ineligibleMentors.filter((x) => x.mentorId !== personId),
    })),
    auditLog: [...state.auditLog.filter((e) => !e.message.includes(personId)), { at, message: "A profile and all data derived from it were deleted." }],
  };
}

export function setMentorVisibility(state: AppState, mentorId: string, visibility: "visible" | "paused", at = now()): AppState {
  const m = getMentor(state, mentorId);
  return {
    ...state,
    mentors: state.mentors.map((x) => (x.id === mentorId ? { ...x, visibility } : x)),
    auditLog: [...state.auditLog, { at, message: `${m.name} ${visibility === "paused" ? "paused" : "resumed"} visibility. Existing approved matches are unaffected; new allocations ${visibility === "paused" ? "skip" : "include"} them.` }],
  };
}
