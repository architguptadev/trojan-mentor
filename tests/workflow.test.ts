import { beforeEach, describe, expect, it } from "vitest";
import { createSeedState } from "@/domain/seed";
import { runAllocation } from "@/domain/cohort";
import {
  approveAction, bilateralValid, confirmMeetingHeld, decideMatch, DomainError, editDraft, executeAction,
  executionBlocker, planAction, setNextFailure, toggleMilestone, updateConsent,
} from "@/domain/workflow";
import { cohortMetrics } from "@/domain/metrics";
import type { AppState } from "@/domain/types";

const T = "2026-11-14T20:00:00.000Z";
let st: AppState;
let matchId: string;

function approveBoth(s: AppState, id: string) {
  s = decideMatch(s, id, "student", "s-maya", "approved", T);
  return decideMatch(s, id, "mentor", "m-daniel", "approved", T);
}
const intro = (s: AppState) => s.actions.find((a) => a.matchId === matchId && a.kind === "introduction_email")!;

beforeEach(() => {
  st = runAllocation(createSeedState(T), { now: T });
  matchId = st.matches.find((m) => m.studentId === "s-maya" && m.mentorId === "m-daniel")!.id;
});

describe("bilateral approval", () => {
  it("requires both parties before anything is planned", () => {
    st = decideMatch(st, matchId, "student", "s-maya", "approved", T);
    expect(st.actions).toHaveLength(0);
    expect(() => planAction(st, matchId, "introduction_email", T)).toThrow(DomainError);
    st = decideMatch(st, matchId, "mentor", "m-daniel", "approved", T);
    expect(st.matches.find((m) => m.id === matchId)!.stage).toBe("approved");
    expect(intro(st).status).toBe("awaiting_approval");
  });

  it("only the right party can decide each side (simulated roles)", () => {
    expect(() => decideMatch(st, matchId, "student", "m-daniel", "approved", T)).toThrow(/Only the student/);
    expect(() => decideMatch(st, matchId, "mentor", "s-maya", "approved", T)).toThrow(/Only the mentor/);
  });

  it("a decline closes the match and plans nothing", () => {
    st = decideMatch(st, matchId, "mentor", "m-daniel", "declined", T);
    expect(st.matches.find((m) => m.id === matchId)!.stage).toBe("declined");
    expect(st.actions).toHaveLength(0);
  });

  it("generates prep and milestones from reviewed fields on bilateral approval", () => {
    st = approveBoth(st, matchId);
    const m = st.matches.find((x) => x.id === matchId)!;
    expect(m.prep.length).toBeGreaterThanOrEqual(3);
    expect(m.prep[0]).toContain("digital health");
    expect(m.milestones).toHaveLength(4);
    expect(m.milestones[0].basis).toMatch(/Target role: Product manager/);
  });
});

describe("outgoing-draft approval", () => {
  beforeEach(() => {
    st = approveBoth(st, matchId);
  });

  it("match approval does not authorize sending: the draft needs its own approval", () => {
    expect(executionBlocker(st, intro(st))).toMatch(/approval/);
    expect(() => executeAction(st, intro(st).id, T)).toThrow(DomainError);
    expect(st.outbox).toHaveLength(0);
  });

  it("only the required approver role can approve", () => {
    expect(() => approveAction(st, intro(st).id, "student", "s-maya", T)).toThrow(/coordinator/);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    expect(intro(st).status).toBe("approved");
  });

  it("editing the draft after approval clears the approval", () => {
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    const a = intro(st);
    if (a.draft.type !== "email") throw new Error();
    st = editDraft(st, a.id, { ...a.draft, body: a.draft.body + "\nP.S. edited" }, T);
    expect(intro(st).status).toBe("awaiting_approval");
    expect(intro(st).approval).toBeUndefined();
    expect(() => executeAction(st, a.id, T)).toThrow(DomainError);
  });

  it("executes exactly once and records simulated delivery", () => {
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    st = executeAction(st, intro(st).id, T);
    expect(intro(st).status).toBe("succeeded");
    expect(intro(st).result?.adapter).toBe("simulated");
    expect(st.outbox).toHaveLength(1);
    expect(st.matches.find((m) => m.id === matchId)!.stage).toBe("introduced");
    expect(() => executeAction(st, intro(st).id, T)).toThrow(/Already completed/);
    expect(st.outbox).toHaveLength(1);
  });
});

describe("retry and idempotency", () => {
  beforeEach(() => {
    st = approveBoth(st, matchId);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
  });

  it("provider rejection → failed, retry succeeds with the same key, one delivery", () => {
    const key = intro(st).idempotencyKey;
    st = setNextFailure(st, "reject");
    st = executeAction(st, intro(st).id, T);
    expect(intro(st).status).toBe("failed");
    expect(intro(st).attempts).toBe(1);
    expect(st.outbox).toHaveLength(0);
    expect(st.nextFailure).toBe("none");
    st = executeAction(st, intro(st).id, T);
    expect(intro(st).status).toBe("succeeded");
    expect(intro(st).attempts).toBe(2);
    expect(intro(st).idempotencyKey).toBe(key);
    expect(st.outbox).toHaveLength(1);
  });

  it("lost acknowledgement → retry observes existing delivery, no duplicate", () => {
    st = setNextFailure(st, "lost_ack");
    st = executeAction(st, intro(st).id, T);
    expect(intro(st).status).toBe("failed");
    expect(st.outbox).toHaveLength(1); // it actually went through
    const providerId = st.outbox[0].providerId;
    st = executeAction(st, intro(st).id, T);
    expect(intro(st).status).toBe("succeeded");
    expect(intro(st).result?.providerId).toBe(providerId);
    expect(st.outbox).toHaveLength(1);
    expect(intro(st).history.at(-1)!.message).toMatch(/No duplicate/);
  });

  it("idempotency keys are stable and unique per action", () => {
    const keys = new Set(st.actions.map((a) => a.idempotencyKey));
    expect(keys.size).toBe(st.actions.length);
    expect(intro(st).idempotencyKey).toBe(`introduction_email:${matchId}:1`);
  });

  it("history records plan, approve, act and observe with timestamps", () => {
    st = setNextFailure(st, "reject");
    st = executeAction(st, intro(st).id, T);
    st = executeAction(st, intro(st).id, T);
    const phases = intro(st).history.map((h) => h.phase);
    expect(phases).toEqual(["plan", "approve", "act", "observe", "act", "observe"]);
    expect(intro(st).history.every((h) => !Number.isNaN(Date.parse(h.at)))).toBe(true);
  });
});

describe("consent withdrawal", () => {
  it("revokes the match and cancels pending actions", () => {
    st = approveBoth(st, matchId);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    st = updateConsent(st, "m-daniel", { matching: false }, T);
    expect(st.matches.find((m) => m.id === matchId)!.stage).toBe("revoked");
    expect(intro(st).status).toBe("cancelled");
    expect(() => executeAction(st, intro(st).id, T)).toThrow(DomainError);
    expect(st.outbox).toHaveLength(0);
  });

  it("a stale approval cannot authorize execution even if consent is re-granted", () => {
    st = approveBoth(st, matchId);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    // Simulate a consent bump without withdrawal (e.g. re-consent cycle) by toggling twice.
    st = updateConsent(st, "s-maya", { matching: false }, T);
    st = updateConsent(st, "s-maya", { matching: true }, T);
    const m = st.matches.find((x) => x.id === matchId)!;
    expect(bilateralValid(st, m)).toBe(false);
    expect(executionBlocker(st, intro(st))).not.toBeNull();
  });

  it("detects consent-version drift on an otherwise approved action", () => {
    st = approveBoth(st, matchId);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    // Directly bump version without going through withdrawal to test the guard itself.
    st = { ...st, students: st.students.map((s) => (s.id === "s-maya" ? { ...s, consent: { ...s.consent, version: s.consent.version + 1 } } : s)) };
    expect(executionBlocker(st, intro(st))).toMatch(/Consent changed|no longer approved/);
  });

  it("external-AI consent changes do not revoke matches", () => {
    st = approveBoth(st, matchId);
    st = updateConsent(st, "s-maya", { externalAI: true }, T);
    expect(bilateralValid(st, st.matches.find((m) => m.id === matchId)!)).toBe(true);
  });

  it("decisions require active consent", () => {
    st = updateConsent(st, "s-maya", { profileProcessing: false }, T);
    expect(() => decideMatch(st, matchId, "student", "s-maya", "approved", T)).toThrow(DomainError);
  });
});

describe("full relationship journey and metrics", () => {
  it("intro → calendar → meeting held → milestones → follow-up, all reflected in metrics", () => {
    st = approveBoth(st, matchId);
    st = approveAction(st, intro(st).id, "coordinator", "coordinator", T);
    st = executeAction(st, intro(st).id, T);
    expect(() => planAction(st, matchId, "calendar_invite", T)).toThrow(/time/);
    st = planAction(st, matchId, "calendar_invite", T, "Tue-evening");
    const cal = () => st.actions.find((a) => a.kind === "calendar_invite")!;
    expect(() => approveAction(st, cal().id, "student", "m-daniel", T)).toThrow();
    st = approveAction(st, cal().id, "student", "s-maya", T);
    st = executeAction(st, cal().id, T);
    expect(st.matches.find((m) => m.id === matchId)!.stage).toBe("meeting_scheduled");
    st = confirmMeetingHeld(st, matchId, "s-maya", T);
    const ms = st.matches.find((m) => m.id === matchId)!.milestones;
    expect(() => toggleMilestone(st, matchId, ms[0].id, "m-daniel", T)).toThrow();
    st = toggleMilestone(st, matchId, ms[0].id, "s-maya", T);
    st = toggleMilestone(st, matchId, ms[1].id, "s-maya", T);
    st = planAction(st, matchId, "follow_up_email", T);
    const fu = () => st.actions.find((a) => a.kind === "follow_up_email")!;
    expect(fu().draft.type === "email" && fu().draft.body).toContain(ms[0].title);
    st = approveAction(st, fu().id, "student", "s-maya", T);
    st = executeAction(st, fu().id, T);

    const k = cohortMetrics(st);
    expect(k.bilateral).toBe(1);
    expect(k.introductions).toBe(1);
    expect(k.invites).toBe(1);
    expect(k.meetingsHeld).toBe(1);
    expect(k.milestonesDone).toBe(2);
    expect(k.milestonesTotal).toBe(4);
    expect(k.deliveries).toBe(3);
    expect(k.capacity).toBe(6); // paused mentor excluded
    expect(k.unmatched).toBe(2);
  });

  it("metrics start at zero activity on a fresh seed", () => {
    const k = cohortMetrics(createSeedState(T));
    expect(k.withMentor).toBe(0);
    expect(k.introductions).toBe(0);
    expect(k.unmatched).toBeNull();
  });
});
