"use client";

import { compatibility } from "@/domain/compatibility";
import type { Match, MentorProfile, StudentProfile } from "@/domain/types";

export function Fictional() {
  return <span className="tag tag-fiction" title="This person is invented for the demo">Fictional</span>;
}

export function StageTag({ stage }: { stage: Match["stage"] }) {
  const map: Record<Match["stage"], [string, string]> = {
    proposed: ["Awaiting both approvals", "tag-wait"],
    approved: ["Both approved", "tag-ok"],
    declined: ["Declined", "tag-bad"],
    revoked: ["Revoked — consent withdrawn", "tag-bad"],
    introduced: ["Introduced (simulated)", "tag-ok"],
    meeting_scheduled: ["Meeting scheduled (simulated)", "tag-ok"],
    meeting_held: ["First meeting held", "tag-ok"],
  };
  const [label, cls] = map[stage];
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function ScoreBreakdown({ student, mentor }: { student: StudentProfile; mentor: MentorProfile }) {
  const c = compatibility(student, mentor);
  return (
    <div>
      <ul className="reasons" aria-label="Score breakdown">
        {c.components.map((x) => (
          <li key={x.key}>
            <span className={`pts num ${x.points ? "" : "zero"}`} aria-label={`${x.points} of ${x.max} points`}>
              +{x.points}
            </span>
            <span>
              <strong style={{ fontWeight: 600 }}>{x.label}</strong>
              <span className="muted"> · up to {x.max}</span>
              <br />
              <span className={x.points ? "" : "muted"}>{x.reason || "No overlap in reviewed fields."}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Heuristic score: keyword overlap plus a small synonym list. Not a probability or model confidence.
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
  return (
    <div className="page loading" role="status">
      Loading demo data from this browser…
    </div>
  );
}

export function first(name: string) {
  return name.split(" ")[0];
}
