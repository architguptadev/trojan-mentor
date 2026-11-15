import { describe, expect, it } from "vitest";
import { createSeedState } from "@/domain/seed";
import { recruitingGaps, seatInsights } from "@/domain/insights";
import { optimalAssignment } from "@/domain/allocator";
import { buildProblem, runAllocation } from "@/domain/cohort";

const T = "2026-11-14T20:00:00.000Z";

describe("coordinator insights", () => {
  it("an extra seat for Elena would match Kenji, and the gain equals a real re-run", () => {
    const st = createSeedState(T);
    const ins = seatInsights(st);
    const elena = ins.find((x) => x.mentorId === "m-elena");
    expect(elena).toBeDefined();
    expect(elena!.newlyMatched).toContain("s-kenji");
    // Gain is exactly the difference between two optimizer runs
    const { mentors, weights, capacities } = buildProblem(st);
    const i = mentors.findIndex((m) => m.id === "m-elena");
    const base = optimalAssignment({ weights, capacities }).total;
    const plus = optimalAssignment({ weights, capacities: capacities.map((c, j) => (j === i ? c + 1 : c)) }).total;
    expect(elena!.gain).toBe(plus - base);
  });

  it("only lists seats with a positive gain, sorted by gain", () => {
    const ins = seatInsights(createSeedState(T));
    expect(ins.every((x) => x.gain > 0)).toBe(true);
    for (let k = 1; k < ins.length; k++) expect(ins[k - 1].gain).toBeGreaterThanOrEqual(ins[k].gain);
  });

  it("names the uncovered direction for a below-threshold student", () => {
    const gaps = recruitingGaps(createSeedState(T));
    const riley = gaps.find((g) => g.studentId === "s-riley");
    expect(riley?.directions).toContain("Marine science");
    expect(gaps.some((g) => g.studentId === "s-kenji")).toBe(false); // Kenji clears the threshold; capacity is the issue
  });

  it("respects locked matches (their seats are not counted as free)", () => {
    let st = runAllocation(createSeedState(T), { now: T });
    st = { ...st, matches: st.matches.map((m) => (m.mentorId === "m-elena" ? { ...m, stage: "approved" as const } : m)) };
    const { mentors, capacities } = buildProblem(st);
    expect(capacities[mentors.findIndex((m) => m.id === "m-elena")]).toBe(0);
  });
});
