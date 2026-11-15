"use client";

import { useId, useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { approveAction, draftHash, editDraft, executeAction, executionBlocker, labelForKind, setNextFailure } from "@/domain/workflow";
import type { CoordinationAction, FailureMode } from "@/domain/types";
import { fmtTime } from "./bits";

const STATUS: Record<CoordinationAction["status"], [string, string]> = {
  awaiting_approval: ["Waiting for approval", "tag-wait"],
  approved: ["Approved — ready to run", "tag-ok"],
  succeeded: ["Recorded (simulated)", "tag-ok"],
  failed: ["Failed — safe to retry", "tag-bad"],
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
  const canApprove =
    (action.status === "awaiting_approval" || (action.status === "failed" && !action.approval)) &&
    role.kind === action.requiredApprover;
  const editable = ["awaiting_approval", "approved", "failed"].includes(action.status) && action.draft.type === "email";
  const runnable = !blocker && (action.status === "approved" || action.status === "failed");
  const kindLabel = labelForKind(action.kind);

  return (
    <article className="stack" style={{ ["--stack" as string]: "10px" }} aria-label={kindLabel}>
      <div className="row-between">
        <h3 style={{ textTransform: "capitalize" }}>{kindLabel}</h3>
        <span className="row" style={{ gap: 8 }}>
          <span className="tag tag-sim">Simulated adapter</span>
          <span className={`tag ${cls}`}>{label}</span>
        </span>
      </div>

      <div className="paa">
        <section aria-label="Plan">
          <h4><span className="step-n">1</span> Plan · exact draft</h4>
          {editing && action.draft.type === "email" ? (
            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              <div className="field">
                <label htmlFor={subjId}>Subject</label>
                <input id={subjId} type="text" value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={bodyId}>Message</label>
                <textarea id={bodyId} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 220, fontSize: "0.88rem" }} />
              </div>
              <div className="row">
                <button
                  className="btn btn-small"
                  onClick={() => {
                    if (action.draft.type !== "email") return;
                    if (apply((s) => editDraft(s, action.id, { ...action.draft, subject, body } as typeof action.draft), action.approval ? "Draft updated. The earlier approval was cleared." : "Draft updated.")) setEditing(false);
                  }}
                >
                  Save draft
                </button>
                <button className="btn btn-small btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <dl className="draft">
              {action.draft.type === "email" ? (
                <>
                  <dt>To</dt>
                  <dd>{action.draft.to.join(", ")}</dd>
                  <dt>Subject</dt>
                  <dd>{action.draft.subject}</dd>
                  <dt>Message</dt>
                  <dd>{action.draft.body}</dd>
                </>
              ) : (
                <>
                  <dt>Event</dt>
                  <dd>{action.draft.title}</dd>
                  <dt>When</dt>
                  <dd>{action.draft.startsAt} · {action.draft.durationMinutes} min</dd>
                  <dt>Guests</dt>
                  <dd>{action.draft.attendees.join(", ")}</dd>
                  <dt>Where</dt>
                  <dd>{action.draft.location}</dd>
                </>
              )}
            </dl>
          )}
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>
            Addresses use the reserved example.org domain. Draft fingerprint <span className="mono">{draftHash(action.draft)}</span>.
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            {editable && !editing && (
              <button className="btn btn-small btn-secondary" onClick={() => { if (action.draft.type === "email") { setSubject(action.draft.subject); setBody(action.draft.body); } setEditing(true); }}>
                Edit draft
              </button>
            )}
          </div>
        </section>

        <section aria-label="Approve and act">
          <h4><span className="step-n">2</span> Approve, then act</h4>
          <p className="small" style={{ marginTop: 0 }}>
            Requires approval from the <strong>{action.requiredApprover}</strong>
            {action.requiredApprover !== "coordinator" && <> ({approverName})</>}.{" "}
            {action.approval ? (
              <span className="muted">Approved {fmtTime(action.approval.at)} for this exact draft.</span>
            ) : (
              <span className="muted">Not yet approved.</span>
            )}
          </p>
          {canApprove ? (
            <button className="btn btn-small" onClick={() => apply((s) => approveAction(s, action.id, role.kind as "coordinator" | "student" | "mentor", actorId(role)), `Approved the ${kindLabel} draft. Nothing has been sent yet.`)}>
              Approve this exact draft
            </button>
          ) : (
            (action.status === "awaiting_approval" || (action.status === "failed" && !action.approval)) && (
              <p className="notice small" style={{ margin: 0 }}>
                Switch “Viewing as” to {action.requiredApprover === "coordinator" ? "Program coordinator" : approverName} to approve.
              </p>
            )
          )}

          {(action.status === "approved" || action.status === "failed") && (
            <div className="stack" style={{ ["--stack" as string]: "10px", marginTop: 14 }}>
              <div className="field">
                <label htmlFor={failId} className="small">Demo control: next simulated attempt</label>
                <select id={failId} value={state.nextFailure} onChange={(e) => apply((s) => setNextFailure(s, e.target.value as FailureMode))}>
                  <option value="none">Succeeds</option>
                  <option value="reject">Provider error — nothing delivered</option>
                  <option value="lost_ack">Timeout after delivery — acknowledgement lost</option>
                </select>
              </div>
              <button className="btn btn-small" disabled={!runnable} onClick={() => {
                  let msg = "";
                  const ok = apply((s) => {
                    const n = executeAction(s, action.id);
                    const a = n.actions.find((x) => x.id === action.id)!;
                    msg = a.status === "succeeded" ? `Simulated ${kindLabel} recorded. Nothing real was sent.` : `Attempt ${a.attempts} failed: ${a.lastError} You can retry safely.`;
                    return n;
                  });
                  if (ok && msg) notify(msg.startsWith("Attempt") ? "error" : "ok", msg);
                }}>
                {action.status === "failed" ? `Retry (attempt ${action.attempts + 1})` : action.draft.type === "email" ? "Send via simulated email" : "Create via simulated calendar"}
              </button>
              {blocker && <p className="small muted" style={{ margin: 0 }}>{blocker}</p>}
            </div>
          )}
          <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Attempts: <span className="num">{action.attempts}</span> · Key <span className="mono" style={{ overflowWrap: "anywhere" }}>{action.idempotencyKey}</span>
          </p>
        </section>

        <section aria-label="Observe">
          <h4><span className="step-n">3</span> Observe</h4>
          {action.status === "succeeded" && action.result && (
            <p className="notice notice-ok small" style={{ marginTop: 0 }}>
              Simulated {action.draft.type === "email" ? "delivery" : "calendar entry"} recorded as <span className="mono">{action.result.providerId}</span>. No real {action.draft.type === "email" ? "email was sent" : "calendar was changed"}.
            </p>
          )}
          {action.status === "failed" && action.lastError && (
            <p className="notice notice-error small" style={{ marginTop: 0 }}>{action.lastError}</p>
          )}
          <ol className="history" aria-label="Action history">
            {action.history.map((h, i) => (
              <li key={i}>
                <time dateTime={h.at}>{fmtTime(h.at)}</time>
                <span>
                  <span className={`phase phase-${h.phase}`}>{h.phase}</span>
                  {h.message}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
