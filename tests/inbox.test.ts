import { describe, expect, it } from "vitest";
import { createSeedState } from "@/domain/seed";
import { runAllocation } from "@/domain/cohort";
import { inboxFor } from "@/domain/inbox";
import { approveAction, decideMatch, executeAction, setNextFailure } from "@/domain/workflow";

const T = "2026-11-14T20:00:00.000Z";

describe("inbox", () => {
  it("prompts the coordinator to allocate first", () => {
    expect(inboxFor(createSeedState(T), { kind: "coordinator" }).map((i) => i.key)).toEqual(["run"]);
  });

  it("follows the journey: decide → approve draft → retry, each for the right person only", () => {
    let st = runAllocation(createSeedState(T), { now: T });
    const m = st.matches.find((x) => x.studentId === "s-maya")!;
    expect(inboxFor(st, { kind: "student", id: "s-maya" }).some((i) => i.key === `decide-${m.id}`)).toBe(true);
    expect(inboxFor(st, { kind: "student", id: "s-jordan" }).some((i) => i.key === `decide-${m.id}`)).toBe(false);
    st = decideMatch(st, m.id, "student", "s-maya", "approved", T);
    expect(inboxFor(st, { kind: "student", id: "s-maya" })).toHaveLength(0);
    st = decideMatch(st, m.id, "mentor", "m-daniel", "approved", T);
    const intro = st.actions[0];
    expect(inboxFor(st, { kind: "coordinator" }).map((i) => i.key)).toContain(`ap-${intro.id}`);
    expect(inboxFor(st, { kind: "student", id: "s-maya" })).toHaveLength(0); // not her approval to give
    st = approveAction(st, intro.id, "coordinator", "coordinator", T);
    st = executeAction(setNextFailure(st, "reject"), intro.id, T);
    expect(inboxFor(st, { kind: "coordinator" })[0].text).toMatch(/^Retry the failed introduction email/);
    st = executeAction(st, intro.id, T);
    expect(inboxFor(st, { kind: "coordinator" }).some((i) => i.key.includes(intro.id))).toBe(false);
  });
});
