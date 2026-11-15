import { greedyAssignment, optimalAssignment } from "./allocator";
import { compatibility } from "./compatibility";
import type { AllocationRun, AppState, Match, MentorProfile, StudentProfile } from "./types";

/** Minimum heuristic score for a pair to be considered at all. Below this we leave a student
 * unmatched rather than manufacture a weak pairing. */
export const DEFAULT_THRESHOLD = 35;

/** Matches that hold a mentor's capacity and a student's slot across re-runs. */
export const LOCKED_STAGES: Match["stage"][] = ["approved", "introduced", "meeting_scheduled", "meeting_held"];

export function studentEligibility(s: StudentProfile): string | null {
  if (!s.consent.profileProcessing) return "Profile processing consent is off.";
  if (!s.consent.matching) return "Matching consent is off, so this profile is hidden from the allocator.";
  if (!s.reviewedAt) return "Profile has not been reviewed yet.";
  return null;
}

export function mentorEligibility(m: MentorProfile): string | null {
  if (!m.optIn) return "Has not opted in to mentor.";
  if (!m.consent.profileProcessing) return "Profile processing consent is off.";
  if (!m.consent.matching) return "Matching consent is off.";
  if (m.visibility !== "visible") return "Visibility is paused.";
  if (m.capacity <= 0) return "No capacity this term.";
  return null;
}

export function pairBlocked(state: AppState, s: StudentProfile, m: MentorProfile): string | null {
  if (s.excludeMentorIds.includes(m.id)) return `${s.name.split(" ")[0]} asked not to be matched with this mentor.`;
  if (m.excludeStudentIds.includes(s.id)) return `${m.name.split(" ")[0]} asked not to be matched with this student.`;
  if (state.matches.some((x) => x.studentId === s.id && x.mentorId === m.id && x.stage === "declined"))
    return "This pairing was declined earlier.";
  return null;
}

export interface AllocationOptions {
  threshold?: number;
  now?: string;
  runId?: string;
}

/** The assignment problem for the current state: eligible mentors with remaining seats, the
 * unlocked eligible student pool, and thresholded weights (null = pair not allowed). */
export function buildProblem(state: AppState, threshold = DEFAULT_THRESHOLD) {
  const locked = state.matches.filter((m) => LOCKED_STAGES.includes(m.stage));
  const lockedStudents = new Set(locked.map((m) => m.studentId));
  const mentors = state.mentors.filter((m) => !mentorEligibility(m));
  const capacities = mentors.map((m) => Math.max(0, m.capacity - locked.filter((x) => x.mentorId === m.id).length));
  const pool = state.students.filter((s) => !studentEligibility(s) && !lockedStudents.has(s.id));
  const weights = pool.map((s) =>
    mentors.map((m) => {
      if (pairBlocked(state, s, m)) return null;
      const { score } = compatibility(s, m);
      return score >= threshold ? score : null;
    }),
  );
  return { mentors, pool, weights, capacities };
}

/**
 * Re-runs the global allocation. Locked (bilaterally approved or further) matches are kept and
 * consume capacity; open proposals are recomputed. Proposals that survive keep their approvals.
 */
export function runAllocation(state: AppState, opts: AllocationOptions = {}): AppState {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const now = opts.now ?? new Date().toISOString();
  const runId = opts.runId ?? `run-${state.allocationRuns.length + 1}`;

  const { mentors, pool, weights, capacities } = buildProblem(state, threshold);
  const ineligibleMentors = state.mentors
    .filter((m) => mentorEligibility(m))
    .map((m) => ({ mentorId: m.id, reason: mentorEligibility(m)! }));

  const opt = optimalAssignment({ weights, capacities });
  const greedy = greedyAssignment({ weights, capacities });

  const assigned: AllocationRun["assigned"] = [];
  const unmatched: AllocationRun["unmatched"] = [];
  pool.forEach((s, i) => {
    const mi = opt.assignment[i];
    if (mi >= 0) assigned.push({ studentId: s.id, mentorId: mentors[mi].id, score: weights[i][mi]! });
    else unmatched.push({ studentId: s.id, reason: explainUnmatched(state, s, mentors, weights[i], opt.assignment, threshold) });
  });
  for (const s of state.students) {
    const why = studentEligibility(s);
    if (why) unmatched.push({ studentId: s.id, reason: why });
  }

  const run: AllocationRun = {
    id: runId,
    at: now,
    threshold,
    totalScore: opt.total,
    greedyTotal: greedy.total,
    greedyAssigned: pool.flatMap((s, i) =>
      greedy.assignment[i] >= 0 ? [{ studentId: s.id, mentorId: mentors[greedy.assignment[i]].id, score: weights[i][greedy.assignment[i]]! }] : [],
    ),
    assigned,
    unmatched,
    ineligibleMentors,
  };

  // Rebuild proposals. Keep any existing open proposal with the same pair (and its approvals).
  const keep = state.matches.filter((m) => LOCKED_STAGES.includes(m.stage) || m.stage === "declined" || m.stage === "revoked");
  const openByPair = new Map(
    state.matches.filter((m) => m.stage === "proposed").map((m) => [`${m.studentId}|${m.mentorId}`, m]),
  );
  const proposals: Match[] = assigned.map((a) => {
    const existing = openByPair.get(`${a.studentId}|${a.mentorId}`);
    if (existing) return { ...existing, score: a.score, allocationRunId: runId };
    return {
      id: `match-${a.studentId}-${a.mentorId}-${runId}`,
      studentId: a.studentId,
      mentorId: a.mentorId,
      score: a.score,
      allocationRunId: runId,
      student: { decision: "pending" },
      mentor: { decision: "pending" },
      stage: "proposed",
      prep: [],
      milestones: [],
      createdAt: now,
    };
  });

  return {
    ...state,
    matches: [...keep, ...proposals],
    allocationRuns: [...state.allocationRuns, run],
    auditLog: [
      ...state.auditLog,
      { at: now, message: `Cohort matched: ${assigned.length} pair${assigned.length === 1 ? "" : "s"} suggested, ${unmatched.length} student${unmatched.length === 1 ? "" : "s"} not matched.` },
    ],
  };
}

function explainUnmatched(
  state: AppState,
  s: StudentProfile,
  mentors: MentorProfile[],
  row: (number | null)[],
  assignment: number[],
  threshold: number,
): string {
  const first = s.name.split(" ")[0];
  const eligible = row.map((w, i) => ({ w, i })).filter((x) => x.w !== null);
  if (eligible.length === 0) {
    // Report the closest candidate honestly, including why it fell short.
    const candidates = mentors
      .map((m) => ({ m, blocked: pairBlocked(state, s, m), c: compatibility(s, m) }))
      .sort((a, b) => b.c.score - a.c.score);
    const best = candidates.find((c) => !c.blocked);
    if (!best) return `${first} asked not to be matched with any of the available alumni.`;
    const parts = best.c.components.filter((c) => c.points > 0).map((c) => c.label.toLowerCase());
    return `None of the current alumni are a close enough fit (the threshold is ${threshold}). The nearest was ${best.m.name.split(" ")[0]} at ${best.c.score}, with only ${parts.length ? parts.join(" and ") : "nothing"} in common.`;
  }
  const used = new Map<number, number>();
  assignment.forEach((m) => m >= 0 && used.set(m, (used.get(m) ?? 0) + 1));
  const names = eligible
    .sort((a, b) => (b.w as number) - (a.w as number))
    .map((x) => mentors[x.i].name.split(" ")[0]);
  return `${names.join(" and ")} would be a good fit, but ${eligible.length > 1 ? "their places" : "the places"} went to stronger matches elsewhere. One more mentor place would let ${first} be matched.`;
}
