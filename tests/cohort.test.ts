import { describe, expect, it } from "vitest";
import { createSeedState } from "@/domain/seed";
import { runAllocation, DEFAULT_THRESHOLD } from "@/domain/cohort";
import { compatibility } from "@/domain/compatibility";
import { decideMatch, updateConsent } from "@/domain/workflow";
import type { AppState } from "@/domain/types";

const T = "2026-11-14T20:00:00.000Z";
const fresh = () => createSeedState(T);
const pairOf = (st: AppState, sid: string) => st.matches.find((m) => m.studentId === sid && m.stage === "proposed");

describe("seed cohort allocation", () => {
  it("produces the optimal total and beats the greedy baseline on the seed", () => {
    const st = runAllocation(fresh(), { now: T });
    const run = st.allocationRuns[0];
    expect(run.totalScore).toBeGreaterThan(run.greedyTotal);
    expect(run.assigned.length).toBeGreaterThan(run.greedyAssigned.length);
    // Greedy gives Marcus to Theo and strands Jordan; the optimizer matches both.
    expect(run.greedyAssigned.find((a) => a.studentId === "s-jordan")).toBeUndefined();
    expect(run.assigned.find((a) => a.studentId === "s-jordan")?.mentorId).toBe("m-marcus");
    expect(run.assigned.find((a) => a.studentId === "s-theo")?.mentorId).toBe("m-daniel");
  });

  it("respects mentor capacity", () => {
    const st = runAllocation(fresh(), { now: T });
    for (const m of st.mentors) {
      const n = st.matches.filter((x) => x.mentorId === m.id && x.stage === "proposed").length;
      expect(n).toBeLessThanOrEqual(m.capacity);
    }
  });

  it("excludes paused mentors and explains it", () => {
    const st = runAllocation(fresh(), { now: T });
    expect(st.matches.some((m) => m.mentorId === "m-sam")).toBe(false);
    expect(st.allocationRuns[0].ineligibleMentors).toEqual([{ mentorId: "m-sam", reason: "Visibility is paused." }]);
  });

  it("honours student exclusions", () => {
    const s = fresh();
    expect(compatibility(s.students.find((x) => x.id === "s-nadia")!, s.mentors.find((x) => x.id === "m-daniel")!).score).toBeGreaterThanOrEqual(DEFAULT_THRESHOLD);
    const st = runAllocation(s, { now: T });
    expect(st.matches.some((m) => m.studentId === "s-nadia" && m.mentorId === "m-daniel")).toBe(false);
  });

  it("honours mentor exclusions", () => {
    const s = fresh();
    s.mentors = s.mentors.map((m) => (m.id === "m-daniel" ? { ...m, excludeStudentIds: ["s-maya"] } : m));
    const st = runAllocation(s, { now: T });
    expect(st.matches.some((m) => m.studentId === "s-maya" && m.mentorId === "m-daniel")).toBe(false);
  });

  it("leaves a below-threshold student unmatched with an honest explanation", () => {
    const st = runAllocation(fresh(), { now: T });
    const riley = st.allocationRuns[0].unmatched.find((u) => u.studentId === "s-riley");
    expect(riley).toBeDefined();
    expect(riley!.reason).toMatch(/close enough fit/);
    expect(st.matches.some((m) => m.studentId === "s-riley")).toBe(false);
  });

  it("explains capacity-driven unmatched outcomes", () => {
    const st = runAllocation(fresh(), { now: T });
    const kenji = st.allocationRuns[0].unmatched.find((u) => u.studentId === "s-kenji");
    expect(kenji?.reason).toMatch(/places went to stronger matches/);
  });

  it("drops students who withdraw matching consent from the pool", () => {
    let s = fresh();
    s = updateConsent(s, "s-maya", { matching: false }, T);
    const st = runAllocation(s, { now: T });
    expect(st.matches.some((m) => m.studentId === "s-maya")).toBe(false);
    expect(st.allocationRuns[0].unmatched.find((u) => u.studentId === "s-maya")?.reason).toMatch(/consent/i);
  });

  it("drops mentors without opt-in", () => {
    const s = fresh();
    s.mentors = s.mentors.map((m) => (m.id === "m-priya" ? { ...m, optIn: false } : m));
    const st = runAllocation(s, { now: T });
    expect(st.matches.some((m) => m.mentorId === "m-priya")).toBe(false);
  });

  it("keeps locked matches across re-runs and does not re-propose declined pairs", () => {
    let st = runAllocation(fresh(), { now: T });
    const maya = pairOf(st, "s-maya")!;
    st = decideMatch(st, maya.id, "student", "s-maya", "approved", T);
    st = decideMatch(st, maya.id, "mentor", "m-daniel", "approved", T);
    const lucia = pairOf(st, "s-lucia")!;
    st = decideMatch(st, lucia.id, "mentor", "m-elena", "declined", T);
    st = runAllocation(st, { now: T });
    expect(st.matches.find((m) => m.id === maya.id)?.stage).toBe("approved");
    // Elena's seat freed by the decline goes to Kenji, and Lucía–Elena is not proposed again.
    expect(st.matches.filter((m) => m.studentId === "s-lucia" && m.mentorId === "m-elena" && m.stage === "proposed")).toHaveLength(0);
    expect(pairOf(st, "s-kenji")?.mentorId).toBe("m-elena");
    // Daniel's locked seat still counts against capacity.
    const danielSeats = st.matches.filter((m) => m.mentorId === "m-daniel" && ["proposed", "approved"].includes(m.stage)).length;
    expect(danielSeats).toBeLessThanOrEqual(2);
  });

  it("scores are explained only by fields that actually overlap", () => {
    const s = fresh();
    const c = compatibility(s.students[0], s.mentors[0]);
    expect(c.score).toBe(c.components.reduce((a, x) => a + x.points, 0));
    for (const comp of c.components) {
      if (comp.points === 0) expect(comp.reason).toBe("");
      else expect(comp.evidence.length).toBeGreaterThan(0);
      expect(comp.points).toBeLessThanOrEqual(comp.max);
    }
  });
});
