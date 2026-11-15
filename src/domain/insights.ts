import { optimalAssignment } from "./allocator";
import { mentorDirection, studentDirection } from "./compatibility";
import { buildProblem, DEFAULT_THRESHOLD } from "./cohort";
import { labelFor } from "./ontology";
import type { AppState } from "./types";

/**
 * Deterministic "what if" analysis for coordinators. Each figure comes from re-running the same
 * optimizer on a modified copy of the current problem. Nothing here is predicted or estimated.
 */
export interface SeatInsight {
  mentorId: string;
  /** Increase in the optimal cohort total if this mentor had one more seat. */
  gain: number;
  /** Students who would gain a mentor (not necessarily this one: the optimizer may reshuffle). */
  newlyMatched: string[];
}

export interface RecruitingGap {
  studentId: string;
  /** Career directions this student is aiming for that no eligible mentor shares. */
  directions: string[];
}

export function seatInsights(state: AppState, threshold = DEFAULT_THRESHOLD): SeatInsight[] {
  const { mentors, pool, weights, capacities } = buildProblem(state, threshold);
  if (pool.length === 0) return [];
  const base = optimalAssignment({ weights, capacities });
  const out: SeatInsight[] = [];
  mentors.forEach((m, i) => {
    const caps = capacities.map((c, j) => (j === i ? c + 1 : c));
    const r = optimalAssignment({ weights, capacities: caps });
    const gain = r.total - base.total;
    if (gain <= 0) return;
    const newlyMatched = pool.filter((_, k) => base.assignment[k] < 0 && r.assignment[k] >= 0).map((s) => s.id);
    out.push({ mentorId: m.id, gain, newlyMatched });
  });
  return out.sort((a, b) => b.gain - a.gain || a.mentorId.localeCompare(b.mentorId));
}

/** Students no eligible mentor clears the threshold for, with the directions that are missing. */
export function recruitingGaps(state: AppState, threshold = DEFAULT_THRESHOLD): RecruitingGap[] {
  const { mentors, pool, weights } = buildProblem(state, threshold);
  const mentorDirs = new Set(mentors.flatMap((m) => [...mentorDirection(m)]));
  return pool
    .map((s, i) => ({ s, row: weights[i] }))
    .filter(({ row }) => row.every((w) => w === null))
    .map(({ s }) => ({
      studentId: s.id,
      directions: [...studentDirection(s)].filter((d) => !mentorDirs.has(d)).map(labelFor),
    }));
}
