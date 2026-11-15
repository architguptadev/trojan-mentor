import { describe, expect, it } from "vitest";
import { bruteForceAssignment, greedyAssignment, optimalAssignment, type AssignmentProblem } from "@/domain/allocator";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function validate(p: AssignmentProblem, assignment: number[]) {
  const used = new Array(p.capacities.length).fill(0);
  let total = 0;
  assignment.forEach((m, s) => {
    if (m < 0) return;
    const w = p.weights[s][m];
    expect(w).not.toBeNull(); // never assigns a disallowed pair
    used[m]++;
    total += w as number;
  });
  used.forEach((u, m) => expect(u).toBeLessThanOrEqual(p.capacities[m])); // capacity respected
  return total;
}

describe("optimalAssignment (min-cost flow)", () => {
  it("beats greedy on a case where the greedy top pick blocks a better total", () => {
    // Student A loves mentor X (90) but is fine with Y (60). Student B only fits X (85).
    // Greedy takes A–X (90) and strands B → 90 + (A has X) ... total 90.
    // Optimal: A–Y (60) + B–X (85) = 145.
    const p: AssignmentProblem = {
      weights: [
        [90, 60],
        [85, null],
      ],
      capacities: [1, 1],
    };
    const greedy = greedyAssignment(p);
    const opt = optimalAssignment(p);
    expect(greedy.total).toBe(90);
    expect(opt.total).toBe(145);
    expect(opt.assignment).toEqual([1, 0]);
    expect(validate(p, opt.assignment)).toBe(145);
  });

  it("matches brute-force enumeration on 300 random small cohorts", () => {
    const r = rng(42);
    for (let t = 0; t < 300; t++) {
      const S = 1 + Math.floor(r() * 6);
      const M = 1 + Math.floor(r() * 4);
      const weights = Array.from({ length: S }, () =>
        Array.from({ length: M }, () => (r() < 0.3 ? null : Math.floor(r() * 100))),
      );
      const capacities = Array.from({ length: M }, () => Math.floor(r() * 3)); // includes 0-capacity mentors
      const p = { weights, capacities };
      const opt = optimalAssignment(p);
      const bf = bruteForceAssignment(p);
      expect(opt.total).toBe(bf.total);
      expect(validate(p, opt.assignment)).toBe(opt.total);
      expect(opt.total).toBeGreaterThanOrEqual(greedyAssignment(p).total);
    }
  });

  it("assigns at most one mentor per student and leaves students unmatched when no edge exists", () => {
    const p = { weights: [[null, null], [50, 40]], capacities: [2, 2] };
    const opt = optimalAssignment(p);
    expect(opt.assignment[0]).toBe(-1);
    expect(opt.assignment[1]).toBe(0);
    expect(opt.total).toBe(50);
  });

  it("respects capacity and leaves the lowest-value student unmatched", () => {
    const p = { weights: [[70], [80], [60]], capacities: [2] };
    const opt = optimalAssignment(p);
    expect(opt.total).toBe(150);
    expect(opt.assignment).toEqual([0, 0, -1]);
  });

  it("is deterministic", () => {
    const p = { weights: [[50, 50], [50, 50], [50, 50]], capacities: [1, 1] };
    expect(optimalAssignment(p)).toEqual(optimalAssignment(p));
  });

  it("handles empty cohorts", () => {
    expect(optimalAssignment({ weights: [], capacities: [] }).total).toBe(0);
    expect(optimalAssignment({ weights: [[10]], capacities: [0] }).assignment).toEqual([-1]);
  });
});
