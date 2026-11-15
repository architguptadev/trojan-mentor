"use client";

import { useId, useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { approveAction, draftHash, editDraft, executeAction, executionBlocker, labelForKind, setNextFailure } from "@/domain/workflow";
import type { CoordinationAction, FailureMode } from "@/domain/types";
import { fmtTime } from "./bits";

const STATUS: Record<CoordinationAction["status"], [string, string]> = {
  awaiting_approval: ["Waiting for approval", "tag-wait"],
  approved: ["Approved, ready to send", "tag-ok"],
  succeeded: ["Recorded (simulated)", "tag-ok"],
  failed: ["Failed, safe to retry", "tag-bad"],
  cancelled: ["Cancelled", "tag-neutral"],
};

export function ActionCard({ action, approverName }: { action: CoordinationAction; approverName: string }) {
  const { state, role, apply, notify } = useApp();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(action.draft.type === "email" ? action.draft.subject : "");
  const [body, setBody] = useState(action.draft.type === "email" ? action.draft.body : "");
  const subjId = useId();
  const bodyId = useId();
  const failId = useId();
  const [label, cls] = STATUS[action.status];
  const blocker = executionBlocker(state, action);
  const needsApproval = action.status === "awaiting_approval" || (action.status === "failed" && !action.approval);
  const canApprove = needsApproval && role.kind === action.requiredApprover;
  const editable = ["awaiting_approval", "approved", "failed"].includes(action.status) && action.draft.type === "email";
  const runnable = !blocker && (action.status === "approved" || action.status === "failed");
  const kindLabel = labelForKind(action.kind);
  const title = kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1);
  const approverLabel = action.requiredApprover === "coordinator" ? "the program coordinator" : approverName;

  const run = () => {
    let msg = "";
    const ok = apply((s) => {
      const n = executeAction(s, action.id);
      const a = n.actions.find((x) => x.id === action.id)!;
      msg = a.status === "succeeded" ? `${title} recorded. Nothing real was sent.` : `That didn’t go through: ${a.lastError} You can retry safely.`;
      return n;
    });
    if (ok && msg) notify(msg.startsWith("That") ? "error" : "ok", msg);
  };

  return (
    <article className="action" aria-label={kindLabel}>
      <header className="action-head">
        <h3>{title}</h3>
        <span className={`tag ${cls}`}>{label}</span>
      </header>
      <div className="action-body">
        <div>
          {editing && action.draft.type === "email" ? (
            <div className="stack" style={{ ["--stack" as string]: "12px" }}>
              <div className="field">
                <label htmlFor={subjId}>Subject</label>
                <input id={subjId} type="text" value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={bodyId}>Message</label>
                <textarea id={bodyId} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 240, fontSize: "0.92rem" }} />
              </div>
              <div className="row">
                <button
                  className="btn btn-small"
                  onClick={() => {
                    if (action.draft.type !== "email") return;
                    if (apply((s) => editDraft(s, action.id, { ...action.draft, subject, body } as typeof action.draft), action.approval ? "Draft saved. It needs approving again." : "Draft saved.")) setEditing(false);
                  }}
                >
                  Save draft
                </button>
                <button className="btn btn-small btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <dl className="letter-meta">
                {action.draft.type === "email" ? (
                  <>
                    <div><dt>To</dt><dd>{action.draft.to.join(", ")}</dd></div>
                    <div><dt>Subject</dt><dd>{action.draft.subject}</dd></div>
                  </>
                ) : (
                  <>
                    <div><dt>Event</dt><dd>{action.draft.title}</dd></div>
                    <div><dt>When</dt><dd>{action.draft.startsAt}, {action.draft.durationMinutes} minutes</dd></div>
                    <div><dt>Guests</dt><dd>{action.draft.attendees.join(", ")}</dd></div>
                  </>
                )}
              </dl>
              {action.draft.type === "email" ? <p className="letter">{action.draft.body}</p> : <p className="letter">{action.draft.location}</p>}
              {editable && (
                <button
                  className="btn btn-small btn-secondary"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    if (action.draft.type === "email") {
                      setSubject(action.draft.subject);
                      setBody(action.draft.body);
                    }
                    setEditing(true);
                  }}
                >
                  Edit draft
                </button>
              )}
            </>
          )}
        </div>

        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          {needsApproval &&
            (canApprove ? (
              <div className="stack" style={{ ["--stack" as string]: "8px" }}>
                <p className="small" style={{ margin: 0 }}>Read it through. Approving covers this exact wording; any edit needs a new approval.</p>
                <button className="btn btn-small" onClick={() => apply((s) => approveAction(s, action.id, role.kind as "coordinator" | "student" | "mentor", actorId(role)), "Approved. Nothing has been sent yet.")}>
                  Approve this exact draft
                </button>
              </div>
            ) : (
              <p className="notice small">Waiting for {approverLabel} to approve. Switch accounts at the top right to act for them.</p>
            ))}

          {(action.status === "approved" || action.status === "failed") && (
            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              <div className="field">
                <label htmlFor={failId} className="small" style={{ fontWeight: 500, color: "var(--ink-2)" }}>For the demo, the next attempt will</label>
                <select id={failId} value={state.nextFailure} onChange={(e) => apply((s) => setNextFailure(s, e.target.value as FailureMode))} style={{ minHeight: 40 }}>
                  <option value="none">Go through</option>
                  <option value="reject">Fail before sending</option>
                  <option value="lost_ack">Send, but lose the confirmation</option>
                </select>
              </div>
              <button className="btn btn-small" disabled={!runnable} onClick={run}>
                {action.status === "failed" ? `Retry (attempt ${action.attempts + 1})` : action.draft.type === "email" ? "Send via simulated email" : "Create via simulated calendar"}
              </button>
              {blocker && <p className="small muted" style={{ margin: 0 }}>{blocker}</p>}
            </div>
          )}

          {action.status === "failed" && action.lastError && <p className="notice notice-error small">{action.lastError}</p>}
          {action.status === "succeeded" && action.result && (
            <p className="notice notice-ok small">Recorded once, even across {action.attempts} attempt{action.attempts > 1 ? "s" : ""}. No real {action.draft.type === "email" ? "email was sent" : "calendar was changed"}.</p>
          )}

          <details open={action.attempts > 0 || undefined}>
            <summary>History ({action.history.length})</summary>
            <ol className="history" style={{ marginTop: 12 }}>
              {action.history.map((h, i) => (
                <li key={i} data-phase={h.phase} data-bad={/^(Failed|Timed out|Cancelled)/.test(h.message) || undefined}>
                  <time dateTime={h.at}>{fmtTime(h.at)}</time>
                  {h.message}
                </li>
              ))}
            </ol>
            <p className="tiny muted" style={{ margin: "4px 0 0" }}>
              Retry key <span className="mono">{action.idempotencyKey}</span>, draft fingerprint <span className="mono">{draftHash(action.draft)}</span>
            </p>
          </details>
        </div>
      </div>
    </article>
  );
}
