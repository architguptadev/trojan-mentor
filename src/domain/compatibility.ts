import { canonicalSet, conceptsInText, labelFor, normalizeTerm } from "./ontology";
import type { MentorProfile, Slot, StudentProfile } from "./types";

/**
 * Heuristic compatibility score (integer 0–100).
 *
 * This is NOT a probability, a prediction of mentorship success, or model confidence.
 * It is an explainable sum of points awarded for overlaps between reviewed profile fields,
 * using keyword matching plus a small hand-written synonym ontology (see ontology.ts).
 */

export const SCORE_WEIGHTS = {
  careerDirection: { max: 40, per: 20 },
  expertise: { max: 25, per: 9 },
  school: { max: 10 },
  communities: { max: 15, per: 8 },
  availability: { max: 10, one: 6 },
} as const;

export interface ScoreComponent {
  key: keyof typeof SCORE_WEIGHTS;
  label: string;
  points: number;
  max: number;
  /** Human sentence grounded in the actual overlapping fields. Empty if no points. */
  reason: string;
  evidence: string[];
}

export interface Compatibility {
  score: number;
  components: ScoreComponent[];
}

export function studentDirection(s: StudentProfile): Set<string> {
  const set = canonicalSet([...s.targetRoles, ...s.industries]);
  for (const c of conceptsInText(s.careerGoals)) set.add(c);
  return set;
}

export function mentorDirection(m: MentorProfile): Set<string> {
  return canonicalSet([...m.roles, ...m.industries]);
}

function intersect<T>(a: Set<T>, b: Set<T>): T[] {
  return [...a].filter((x) => b.has(x)).sort();
}

export function sharedSlots(a: Slot[], b: Slot[]): Slot[] {
  const bs = new Set(b);
  return a.filter((s) => bs.has(s));
}

export function slotLabel(s: Slot): string {
  const [d, p] = s.split("-");
  return `${d} ${p}`;
}

export function compatibility(s: StudentProfile, m: MentorProfile): Compatibility {
  const W = SCORE_WEIGHTS;
  const components: ScoreComponent[] = [];

  const dir = intersect(studentDirection(s), mentorDirection(m));
  const dirPts = Math.min(W.careerDirection.max, dir.length * W.careerDirection.per);
  components.push({
    key: "careerDirection",
    label: "Career direction",
    points: dirPts,
    max: W.careerDirection.max,
    evidence: dir.map(labelFor),
    reason: dir.length
      ? `${first(s.name)} is aiming for ${list(dir.map(labelFor))}; ${first(m.name)} has worked in ${dir.length > 1 ? "those areas" : "that area"}.`
      : "",
  });

  const studentSkills = canonicalSet([...s.skills, ...s.interests]);
  const exp = intersect(studentSkills, canonicalSet(m.expertise));
  // Expertise the student lists as a goal-adjacent interest also counts, once.
  const expPts = Math.min(W.expertise.max, exp.length * W.expertise.per);
  components.push({
    key: "expertise",
    label: "Relevant expertise",
    points: expPts,
    max: W.expertise.max,
    evidence: exp.map(labelFor),
    reason: exp.length
      ? `${first(m.name)} lists ${list(exp.map(labelFor))} as expertise, which ${first(s.name)} included in skills or interests.`
      : "",
  });

  const sameSchool = normalizeTerm(s.school) === normalizeTerm(m.school) && s.school.trim() !== "";
  components.push({
    key: "school",
    label: "Shared USC school",
    points: sameSchool ? W.school.max : 0,
    max: W.school.max,
    evidence: sameSchool ? [s.school] : [],
    reason: sameSchool ? `Both studied in ${s.school}.` : "",
  });

  const comm = intersect(canonicalSet(s.communities), canonicalSet(m.communities));
  const commPts = Math.min(W.communities.max, comm.length * W.communities.per);
  components.push({
    key: "communities",
    label: "Shared community",
    points: commPts,
    max: W.communities.max,
    evidence: comm.map(labelFor),
    reason: comm.length ? `Both listed ${list(comm.map(labelFor))}.` : "",
  });

  const slots = sharedSlots(s.availability, m.availability);
  const availPts = slots.length >= 2 ? W.availability.max : slots.length === 1 ? W.availability.one : 0;
  components.push({
    key: "availability",
    label: "Compatible availability",
    points: availPts,
    max: W.availability.max,
    evidence: slots.map(slotLabel),
    reason: slots.length
      ? `Overlapping time${slots.length > 1 ? "s" : ""}: ${list(slots.slice(0, 3).map(slotLabel))}.`
      : "",
  });

  const score = components.reduce((a, c) => a + c.points, 0);
  return { score, components };
}

function first(name: string) {
  return name.split(" ")[0];
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
