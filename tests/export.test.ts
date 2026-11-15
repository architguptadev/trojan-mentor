import { describe, expect, it } from "vitest";
import { cohortCsv, csvCell, personExport } from "@/lib/export";
import { createSeedState } from "@/domain/seed";
import { runAllocation } from "@/domain/cohort";

const T = "2026-11-14T20:00:00.000Z";

describe("exports", () => {
  it("neutralizes spreadsheet formulas and quotes special characters", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("cohort CSV has one row per live match and per unmatched student", () => {
    const st = runAllocation(createSeedState(T), { now: T });
    const lines = cohortCsv(st).trim().split("\r\n");
    expect(lines[0]).toMatch(/^status,student/);
    expect(lines.filter((l) => l.startsWith("matched"))).toHaveLength(6);
    expect(lines.filter((l) => l.startsWith("unmatched"))).toHaveLength(2);
    expect(lines.find((l) => l.includes("Riley"))).toMatch(/threshold/);
  });

  it("person export contains only that person's data", () => {
    const st = runAllocation(createSeedState(T), { now: T });
    const e = personExport(st, "s-maya")!;
    expect(e.profile.id).toBe("s-maya");
    expect(e.matches.every((m) => m.studentId === "s-maya")).toBe(true);
    expect(personExport(st, "nobody")).toBeNull();
  });
});
