import type { AppState } from "./types";
import { bilateralValid, executionBlocker, labelForKind } from "./workflow";

export type InboxRole = { kind: "coordinator" } | { kind: "student"; id: string } | { kind: "mentor"; id: string };

export interface InboxItem {
  key: string;
  text: string;
  href: string;
  /** Lower sorts first. */
  priority: number;
}

const first = (n?: string) => (n ?? "").split(" ")[0];

/** What is waiting on this (simulated) person right now, derived only from current state. */
export function inboxFor(state: AppState, role: InboxRole): InboxItem[] {
  const items: InboxItem[] = [];
  const S = (id: string) => state.students.find((s) => s.id === id);
  const M = (id: string) => state.mentors.find((m) => m.id === id);
  const pair = (matchId: string) => {
    const m = state.matches.find((x) => x.id === matchId)!;
    return `${first(S(m.studentId)?.name)} & ${first(M(m.mentorId)?.name)}`;
  };

  if (role.kind === "coordinator" && state.allocationRuns.length === 0)
    items.push({ key: "run", text: "Run the first cohort allocation", href: "/cohort", priority: 0 });

  for (const m of state.matches) {
    const href = `/matches/${m.id}`;
    const mine = role.kind === "student" ? m.studentId === role.id : role.kind === "mentor" ? m.mentorId === role.id : false;
    if (m.stage === "proposed" && mine) {
      const side = role.kind === "student" ? m.student : m.mentor;
      if (side.decision === "pending") {
        const other = role.kind === "student" ? M(m.mentorId)?.name : S(m.studentId)?.name;
        items.push({ key: `decide-${m.id}`, text: `Decide on your proposed match with ${other}`, href, priority: 1 });
      }
    }
    if (mine && m.stage === "meeting_scheduled" && bilateralValid(state, m))
      items.push({ key: `held-${m.id}`, text: `Confirm whether your first meeting happened (${m.meeting?.startsAt})`, href, priority: 3 });
    if (role.kind === "student" && mine && m.stage === "meeting_held" && bilateralValid(state, m)) {
      const open = m.milestones.filter((x) => !x.done).length;
      if (open) items.push({ key: `ms-${m.id}`, text: `${open} milestone${open > 1 ? "s" : ""} still open with ${first(M(m.mentorId)?.name)}`, href, priority: 5 });
    }
  }

  for (const a of state.actions) {
    const m = state.matches.find((x) => x.id === a.matchId);
    if (!m) continue;
    const isApprover =
      a.requiredApprover === role.kind &&
      (role.kind === "coordinator" || (role.kind === "student" ? m.studentId === role.id : m.mentorId === role.id));
    if (!isApprover) continue;
    const href = `/matches/${m.id}`;
    if (a.status === "awaiting_approval")
      items.push({ key: `ap-${a.id}`, text: `Review and approve the ${labelForKind(a.kind)} for ${pair(m.id)}`, href, priority: 2 });
    else if ((a.status === "approved" || a.status === "failed") && !executionBlocker(state, a))
      items.push({
        key: `run-${a.id}`,
        text: a.status === "failed" ? `Retry the failed ${labelForKind(a.kind)} for ${pair(m.id)}` : `Send the approved ${labelForKind(a.kind)} for ${pair(m.id)}`,
        href,
        priority: a.status === "failed" ? 1 : 2,
      });
  }
  return items.sort((x, y) => x.priority - y.priority || x.text.localeCompare(y.text));
}
