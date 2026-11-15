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

const DAY_NAMES: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
export function slotLabel(s: Slot): string {
  const [d, p] = s.split("-");
  return `${DAY_NAMES[d] ?? d} ${p}s`;
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
      ? `${first(s.name)} is aiming for ${list(dir.map((x) => lower(labelFor(x))))}, where ${first(m.name)} has worked.`
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
      ? `${first(m.name)} can help with ${list(exp.map((x) => lower(labelFor(x))))}, which ${first(s.name)} listed too.`
      : "",
  });

  const sameSchool = normalizeTerm(s.school) === normalizeTerm(m.school) && s.school.trim() !== "";
  components.push({
    key: "school",
    label: "Shared USC school",
    points: sameSchool ? W.school.max : 0,
    max: W.school.max,
    evidence: sameSchool ? [s.school] : [],
    reason: sameSchool ? `Both came through the ${s.school}.` : "",
  });

  const comm = intersect(canonicalSet(s.communities), canonicalSet(m.communities));
  const commPts = Math.min(W.communities.max, comm.length * W.communities.per);
  components.push({
    key: "communities",
    label: "Shared community",
    points: commPts,
    max: W.communities.max,
    evidence: comm.map(labelFor),
    reason: comm.length ? `They share ${comm.length > 1 ? "communities" : "a community"}: ${list(comm.map((x) => lower(labelFor(x))))}.` : "",
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
      ? `Both are usually free ${list(slots.slice(0, 3).map(slotLabel))}.`
      : "",
  });

  const score = components.reduce((a, c) => a + c.points, 0);
  return { score, components };
}

const PROPER = new Set(["Python", "JavaScript / TypeScript", "UX", "ML", "AI", "SQL", "R"]);
/** Sentence-case a concept label for use mid-sentence, keeping proper nouns and acronyms. */
export function lower(label: string) {
  if (PROPER.has(label)) return label;
  return label
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.charAt(0).toLowerCase() + w.slice(1)))
    .join(" ");
}

function first(name: string) {
  return name.split(" ")[0];
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
