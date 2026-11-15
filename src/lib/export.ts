import { topReasonText } from "./exportReasons";
import type { AppState } from "@/domain/types";

/** Escape a CSV cell, including spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Cohort allocation export for a coordinator. Mirrors what the cohort page shows. */
export function cohortCsv(state: AppState): string {
  const run = state.allocationRuns.at(-1);
  const rows: unknown[][] = [["status", "student", "student_school", "mentor", "heuristic_score", "stage", "explanation", "fictional"]];
  for (const m of state.matches.filter((x) => x.stage !== "declined" && x.stage !== "revoked")) {
    const s = state.students.find((x) => x.id === m.studentId);
    const mt = state.mentors.find((x) => x.id === m.mentorId);
    if (!s || !mt) continue;
    rows.push(["matched", s.name, s.school, mt.name, m.score, m.stage, topReasonText(s, mt), s.fictional && mt.fictional ? "yes" : "no"]);
  }
  for (const u of run?.unmatched ?? []) {
    const s = state.students.find((x) => x.id === u.studentId);
    if (s) rows.push(["unmatched", s.name, s.school, "", "", "", u.reason, s.fictional ? "yes" : "no"]);
  }
  return toCsv(rows);
}

/** Everything held about one person in this browser, for a data-access request. */
export function personExport(state: AppState, personId: string) {
  const person = state.students.find((s) => s.id === personId) ?? state.mentors.find((m) => m.id === personId);
  if (!person) return null;
  const matches = state.matches.filter((m) => m.studentId === personId || m.mentorId === personId);
  const ids = new Set(matches.map((m) => m.id));
  const actions = state.actions.filter((a) => ids.has(a.matchId));
  const keys = new Set(actions.map((a) => a.idempotencyKey));
  return {
    exportedAt: new Date().toISOString(),
    note: "Trojan Mentor demo export. All data shown was stored only in this browser. Raw resumes are never stored.",
    profile: person,
    matches,
    coordinationActions: actions,
    simulatedDeliveries: state.outbox.filter((o) => keys.has(o.idempotencyKey)),
  };
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
