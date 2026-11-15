"use client";

import { compatibility } from "@/domain/compatibility";
import type { Match, MentorProfile, StudentProfile } from "@/domain/types";

export function Fictional() {
  return <span className="tag tag-fiction">Fictional</span>;
}

const STAGES: Record<Match["stage"], [string, string]> = {
  proposed: ["Waiting for both to approve", "tag-wait"],
  approved: ["Both approved", "tag-ok"],
  declined: ["Declined", "tag-bad"],
  revoked: ["Revoked after consent was withdrawn", "tag-bad"],
  introduced: ["Introduced (simulated)", "tag-ok"],
  meeting_scheduled: ["Meeting scheduled (simulated)", "tag-ok"],
  meeting_held: ["First meeting held", "tag-ok"],
};

export function StageTag({ stage }: { stage: Match["stage"] }) {
  const [label, cls] = STAGES[stage];
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function ScoreBreakdown({ student, mentor }: { student: StudentProfile; mentor: MentorProfile }) {
  const c = compatibility(student, mentor);
  return (
    <div>
      <ul className="reasons" aria-label="Score breakdown">
        {c.components.map((x) => (
          <li key={x.key}>
            <span className={`pts num ${x.points ? "" : "zero"}`} aria-label={`${x.points} of ${x.max} points`}>+{x.points}</span>
            <span>
              <strong style={{ fontWeight: 600, color: "var(--ink)" }}>{x.label}</strong>
              <br />
              <span className={x.points ? "" : "muted"}>{x.reason || "Nothing in common here."}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="tiny muted" style={{ margin: "10px 0 0" }}>
        Points out of 100, from overlapping profile fields. A rough guide to fit, not a prediction.
      </p>
    </div>
  );
}

export function topReasons(student: StudentProfile, mentor: MentorProfile, n = 3) {
  return compatibility(student, mentor)
    .components.filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

export function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Loading() {
  return <div className="page loading" role="status">Loading…</div>;
}

export function first(name: string) {
  return name.split(" ")[0];
}
