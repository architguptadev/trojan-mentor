import { LOCKED_STAGES, mentorEligibility, studentEligibility } from "./cohort";
import type { AppState } from "./types";

/** Every figure is computed from current application state. Nothing is estimated or invented. */
export function cohortMetrics(state: AppState) {
  const participating = state.students.filter((s) => !studentEligibility(s));
  const activeMentors = state.mentors.filter((m) => !mentorEligibility(m));
  const capacity = activeMentors.reduce((a, m) => a + m.capacity, 0);
  const live = state.matches.filter((m) => m.stage === "proposed" || LOCKED_STAGES.includes(m.stage));
  const seatsHeld = live.filter((m) => activeMentors.some((x) => x.id === m.mentorId)).length;
  const bilateral = state.matches.filter((m) => LOCKED_STAGES.includes(m.stage));
  const awaiting = state.matches.filter((m) => m.stage === "proposed");
  const introductions = state.outbox.filter((o) => o.kind === "introduction_email").length;
  const invites = state.outbox.filter((o) => o.kind === "calendar_invite").length;
  const held = state.matches.filter((m) => m.stage === "meeting_held").length;
  const milestones = bilateral.flatMap((m) => m.milestones);
  const done = milestones.filter((x) => x.done).length;
  const latest = state.allocationRuns.at(-1);
  const failedAttempts = state.actions.reduce((a, x) => a + x.history.filter((h) => h.phase === "observe" && /^(Failed|Timed out)/.test(h.message)).length, 0);
  const pendingApprovals = state.actions.filter((a) => a.status === "awaiting_approval").length;
  return {
    studentsTotal: state.students.length,
    participating: participating.length,
    withMentor: live.length,
    coverage: participating.length ? live.length / participating.length : 0,
    unmatched: latest ? latest.unmatched.length : null,
    mentorsActive: activeMentors.length,
    mentorsTotal: state.mentors.length,
    capacity,
    seatsHeld,
    awaitingDecisions: awaiting.length,
    bilateral: bilateral.length,
    introductions,
    invites,
    meetingsHeld: held,
    milestonesDone: done,
    milestonesTotal: milestones.length,
    pendingApprovals,
    failedAttempts,
    deliveries: state.outbox.length,
    latestRun: latest ?? null,
  };
}

export type CohortMetrics = ReturnType<typeof cohortMetrics>;
