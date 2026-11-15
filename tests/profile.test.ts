import { describe, expect, it } from "vitest";
import { createSeedState } from "@/domain/seed";
import { runAllocation } from "@/domain/cohort";
import { decideMatch, DomainError, updateMentorProfile, updateStudentProfile } from "@/domain/workflow";
import { compatibility } from "@/domain/compatibility";

const T = "2026-11-14T20:00:00.000Z";

describe("profile editing", () => {
  it("students can edit only their own profile, and edits change future scoring", () => {
    const st = createSeedState(T);
    expect(() => updateStudentProfile(st, "s-riley", "s-maya", { careerGoals: "x" }, T)).toThrow(DomainError);
    const riley = () => next.students.find((s) => s.id === "s-riley")!;
    const before = compatibility(st.students.find((s) => s.id === "s-riley")!, st.mentors.find((m) => m.id === "m-priya")!).score;
    const next = updateStudentProfile(st, "s-riley", "s-riley", { targetRoles: ["Data scientist"], careerGoals: "Data science for ocean conservation research." }, T);
    expect(compatibility(riley(), next.mentors.find((m) => m.id === "m-priya")!).score).toBeGreaterThan(before);
    expect(riley().reviewedAt).toBe(T);
  });

  it("rejects empty required fields", () => {
    const st = createSeedState(T);
    expect(() => updateStudentProfile(st, "s-maya", "s-maya", { availability: [] }, T)).toThrow(/free/);
    expect(() => updateStudentProfile(st, "s-maya", "s-maya", { name: " " }, T)).toThrow(/name/);
  });

  it("mentors can't drop capacity below their active mentees", () => {
    let st = runAllocation(createSeedState(T), { now: T });
    const m = st.matches.find((x) => x.mentorId === "m-daniel")!;
    st = decideMatch(st, m.id, "student", m.studentId, "approved", T);
    st = decideMatch(st, m.id, "mentor", "m-daniel", "approved", T);
    expect(() => updateMentorProfile(st, "m-daniel", "m-daniel", { capacity: 0 }, T)).toThrow(/can’t go below 1/);
    const ok = updateMentorProfile(st, "m-daniel", "m-daniel", { capacity: 3 }, T);
    expect(ok.mentors.find((x) => x.id === "m-daniel")!.capacity).toBe(3);
    expect(() => updateMentorProfile(st, "m-daniel", "m-priya", { capacity: 3 }, T)).toThrow(DomainError);
  });
});
