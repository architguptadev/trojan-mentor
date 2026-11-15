"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type Role } from "@/lib/store";
import { LOCKED_STAGES } from "@/domain/cohort";
import { Loading } from "@/components/bits";

export default function DemoPage() {
  const { state, ready, setRole } = useApp();
  const router = useRouter();
  if (!ready) return <Loading />;

  const go = (href: string, role?: Role) => () => {
    if (role) setRole(role);
    router.push(href);
  };
  const userStudent = state.students.find((s) => s.source !== "seed");
  const firstLocked = state.matches.find((m) => LOCKED_STAGES.includes(m.stage));
  const firstProposed = state.matches.find((m) => m.stage === "proposed");
  const focus = firstLocked ?? firstProposed;
  const focusHref = focus ? `/matches/${focus.id}` : "/cohort";
  const anyMilestone = state.matches.some((m) => m.stage === "meeting_held" && m.milestones.some((x) => x.done));

  const steps = [
    {
      title: "Onboard a student and review the extracted profile",
      body: "Use the fictional sample resume. The demo parser (not AI) fills editable fields that you must review before saving.",
      done: !!userStudent,
      action: { label: "Open student onboarding", onClick: go("/onboard/student", { kind: "coordinator" }) },
    },
    {
      title: "Optional: add an alumni mentor",
      body: "Explicit opt-in, capacity and visibility controls. Adding capacity can change who gets matched.",
      done: state.mentors.some((m) => m.id.startsWith("m-user-")),
      optional: true,
      action: { label: "Open alumni onboarding", onClick: go("/onboard/alumni", { kind: "coordinator" }) },
    },
    {
      title: "Allocate the cohort",
      body: "Run the global optimizer. See proposed pairs, explanations, unmatched students, and how it compares with greedy matching.",
      done: state.allocationRuns.length > 0,
      action: { label: "Go to the cohort", onClick: go("/cohort", { kind: "coordinator" }) },
    },
    {
      title: "Student and mentor both approve",
      body: "Switch to each simulated role on a match page. Either can decline. Match approval does not approve any message.",
      done: !!firstLocked,
      action: { label: focus ? "Open a proposed match" : "Allocate first", onClick: go(focusHref) },
    },
    {
      title: "Approve the introduction draft",
      body: "As coordinator, read the exact draft and approve it. Try “simulate a failure” to see the retry path without duplicates.",
      done: state.outbox.some((o) => o.kind === "introduction_email"),
      action: { label: "Open the match", onClick: go(focusHref, { kind: "coordinator" }) },
    },
    {
      title: "Coordinate the first meeting",
      body: "As the student, choose an overlapping time and approve the simulated calendar invitation.",
      done: state.outbox.some((o) => o.kind === "calendar_invite"),
      action: { label: "Open the match", onClick: go(focusHref, focus ? { kind: "student", id: focus.studentId } : undefined) },
    },
    {
      title: "Confirm the meeting and complete milestones",
      body: "Record that the meeting happened, then check off template-based milestones drawn from the student’s goals.",
      done: anyMilestone,
      action: { label: "Open the match", onClick: go(focusHref, focus ? { kind: "student", id: focus.studentId } : undefined) },
    },
    {
      title: "See the updated cohort metrics",
      body: "Every figure is computed from the current state in this browser.",
      done: false,
      action: { label: "Open the dashboard", onClick: go("/dashboard") },
    },
  ];
  const nextIdx = steps.findIndex((s) => !s.done && !s.optional);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Guided demo</p>
        <h1>Walk the whole journey in about five minutes</h1>
        <p className="lede">
          A fictional cohort of eight students and five alumni is already loaded. Progress below updates from what you’ve
          actually done, and survives a page refresh.
        </p>
      </header>

      <div className="split">
        <ol className="checklist" aria-label="Demo steps">
          {steps.map((s, i) => (
            <li key={s.title} data-done={s.done} data-next={i === nextIdx}>
              <span className="mark" aria-hidden="true">
                {s.done ? "✓" : i + 1}
              </span>
              <div>
                <h3>
                  {s.title} {s.done && <span className="sr-only">(done)</span>}
                  {i === nextIdx && <span className="sr-only">(next step)</span>}
                </h3>
                <p>{s.body}</p>
              </div>
              <button className={`btn btn-small ${i === nextIdx ? "" : "btn-secondary"}`} onClick={s.action.onClick}>
                {s.action.label}
              </button>
            </li>
          ))}
        </ol>

        <aside className="stack" aria-label="About this demo">
          <div className="panel stack">
            <h3>Simulated roles</h3>
            <p className="small" style={{ margin: 0 }}>
              Use <strong>Viewing as</strong> under the header to act as the coordinator, a student or a mentor. This is a
              demo convenience to show bilateral approval — it is not authentication, and anyone using this browser can switch.
            </p>
          </div>
          <div className="panel stack">
            <h3>What’s real and what’s simulated</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Real: scoring, the cohort optimizer, consent rules, approvals, retry and idempotency logic.</li>
              <li>Simulated: email and calendar delivery. Nothing is ever sent; the app records what would have been sent.</li>
              <li>Fictional: every person, employer and activity in the cohort.</li>
              <li>Local only: data is stored in this browser’s localStorage, not shared across devices.</li>
            </ul>
          </div>
          <div className="panel stack">
            <h3>Start over any time</h3>
            <p className="small" style={{ margin: 0 }}>
              “Reset demo data” in the top strip restores the original cohort. Individual profiles can be deleted from{" "}
              <Link href="/privacy">Privacy & data</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
