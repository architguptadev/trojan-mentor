// Core domain types for Trojan Mentor. All domain logic is pure and framework-free
// so it can be unit-tested and later moved behind a server/database boundary.

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type DayPart = "morning" | "afternoon" | "evening";
/** e.g. "Tue-evening" */
export type Slot = `${Weekday}-${DayPart}`;

export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_PARTS: DayPart[] = ["morning", "afternoon", "evening"];

export interface Consent {
  /** Store and process the reviewed profile in this application. Required to participate. */
  profileProcessing: boolean;
  /** Send an uploaded document to an external AI provider (Gemini) for interpretation. */
  externalAI: boolean;
  /** Be visible to the allocator and participate in matching. */
  matching: boolean;
  /** Monotonic counter, bumped on every consent change. Approvals capture it. */
  version: number;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  kind: "student";
  name: string;
  pronouns?: string;
  school: string;
  program: string;
  gradYear: number;
  careerGoals: string;
  targetRoles: string[];
  industries: string[];
  skills: string[];
  interests: string[];
  communities: string[];
  availability: Slot[];
  /** Mentor ids this student does not want to be matched with. */
  excludeMentorIds: string[];
  consent: Consent;
  fictional: boolean;
  /** How the profile's fields were produced before human review. */
  source: "seed" | "manual" | "demo-parser" | "gemini";
  reviewedAt?: string;
  createdAt: string;
}

export interface MentorProfile {
  id: string;
  kind: "mentor";
  name: string;
  pronouns?: string;
  headline: string;
  school: string;
  gradYear: number;
  trajectory: { role: string; org: string; years: string }[];
  industries: string[];
  roles: string[];
  expertise: string[];
  communities: string[];
  mentoringPreferences: string;
  availability: Slot[];
  capacity: number;
  /** Explicit opt-in to be a mentor in this program. */
  optIn: boolean;
  /** Visible to the allocator. Mentors can pause without deleting. */
  visibility: "visible" | "paused";
  excludeStudentIds: string[];
  consent: Consent;
  fictional: boolean;
  createdAt: string;
}

export type Person = StudentProfile | MentorProfile;

export type Decision = "pending" | "approved" | "declined";

export interface PartyApproval {
  decision: Decision;
  at?: string;
  /** Consent version at the moment of approval. Stale if consent changed since. */
  consentVersion?: number;
}

export type MatchStage =
  | "proposed" // allocated, awaiting both parties
  | "approved" // both approved
  | "declined" // one party declined
  | "revoked" // consent withdrawn after approval
  | "introduced" // introduction delivered (simulated)
  | "meeting_scheduled"
  | "meeting_held";

export interface Milestone {
  id: string;
  title: string;
  detail: string;
  basis: string; // which reviewed field this came from
  done: boolean;
  completedAt?: string;
}

export interface Match {
  id: string;
  studentId: string;
  mentorId: string;
  score: number;
  allocationRunId: string;
  student: PartyApproval;
  mentor: PartyApproval;
  stage: MatchStage;
  meeting?: { slot: Slot; startsAt: string; confirmedHeldAt?: string };
  prep: string[];
  milestones: Milestone[];
  createdAt: string;
}

export type ActionKind = "introduction_email" | "calendar_invite" | "follow_up_email";
export type ActionStatus =
  | "awaiting_approval"
  | "approved"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface EmailDraft {
  type: "email";
  to: string[];
  subject: string;
  body: string;
}
export interface CalendarDraft {
  type: "calendar";
  title: string;
  attendees: string[];
  slot: Slot;
  startsAt: string;
  durationMinutes: number;
  location: string;
}
export type Draft = EmailDraft | CalendarDraft;

export type ApproverRole = "coordinator" | "student" | "mentor";

export interface ActionEvent {
  at: string;
  phase: "plan" | "approve" | "act" | "observe";
  message: string;
}

export interface CoordinationAction {
  id: string;
  matchId: string;
  kind: ActionKind;
  /** Stable for the lifetime of the action; reused across retries. */
  idempotencyKey: string;
  draft: Draft;
  /** Hash of the exact draft that was approved. Editing the draft invalidates approval. */
  approval?: {
    role: ApproverRole;
    by: string;
    at: string;
    draftHash: string;
    consentVersions: { student: number; mentor: number };
  };
  requiredApprover: ApproverRole;
  status: ActionStatus;
  attempts: number;
  lastError?: string;
  result?: { providerId: string; observedAt: string; adapter: "simulated" };
  history: ActionEvent[];
  createdAt: string;
}

export interface OutboxEntry {
  idempotencyKey: string;
  providerId: string;
  kind: ActionKind;
  deliveredAt: string;
  summary: string;
}

export type FailureMode = "none" | "reject" | "lost_ack";

export interface AllocationRun {
  id: string;
  at: string;
  threshold: number;
  totalScore: number;
  greedyTotal: number;
  greedyAssigned: { studentId: string; mentorId: string; score: number }[];
  assigned: { studentId: string; mentorId: string; score: number }[];
  unmatched: { studentId: string; reason: string }[];
  ineligibleMentors: { mentorId: string; reason: string }[];
}

export interface AppState {
  schemaVersion: number;
  seededAt: string;
  students: StudentProfile[];
  mentors: MentorProfile[];
  matches: Match[];
  actions: CoordinationAction[];
  /** Simulated provider ledger. Exactly one entry per delivered idempotency key. */
  outbox: OutboxEntry[];
  allocationRuns: AllocationRun[];
  /** Demo control: how the simulated adapter behaves on its next attempt. */
  nextFailure: FailureMode;
  auditLog: { at: string; message: string }[];
}
