"use client";

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
  const locked = state.matches.find((m) => LOCKED_STAGES.includes(m.stage));
  const proposed = state.matches.find((m) => m.stage === "proposed");
  const focus = locked ?? proposed;
  const focusHref = focus ? `/matches/${focus.id}` : "/cohort";
  const asStudent = focus ? ({ kind: "student", id: focus.studentId } as Role) : undefined;

  const steps = [
    { title: "Onboard a student", body: "Use the sample resume, check the details it fills in, and save.", done: state.students.some((s) => s.source !== "seed"), label: "Open student onboarding", onClick: go("/onboard/student", { kind: "coordinator" }) },
    { title: "Match the cohort", body: "Place every student at once and see who wasn’t matched, and why.", done: state.allocationRuns.length > 0, label: "Go to the cohort", onClick: go("/cohort", { kind: "coordinator" }) },
    { title: "Approve as the student, then the alum", body: "Switch “Viewing as” to each of them on a match page.", done: !!locked, label: focus ? "Open a match" : "Match the cohort first", onClick: go(focusHref) },
    { title: "Approve and send the introduction", body: "As coordinator, read the exact email. Try forcing a failure, then retry.", done: state.outbox.some((o) => o.kind === "introduction_email"), label: "Open the match", onClick: go(focusHref, { kind: "coordinator" }) },
    { title: "Plan the first meeting", body: "As the student, pick a time you’re both free and approve the invitation.", done: state.outbox.some((o) => o.kind === "calendar_invite"), label: "Open the match", onClick: go(focusHref, asStudent) },
    { title: "Confirm the meeting and tick off milestones", body: "Next steps come from the student’s own goals.", done: state.matches.some((m) => m.stage === "meeting_held" && m.milestones.some((x) => x.done)), label: "Open the match", onClick: go(focusHref, asStudent) },
    { title: "Check the dashboard", body: "Every number comes from what you just did.", done: false, label: "Open the dashboard", onClick: go("/dashboard") },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Walk through a full match</h1>
        <p className="lede">A small fictional cohort is already loaded: eight students and five alumni. Your progress is saved in this browser.</p>
      </header>

      <div className="split">
        <ol className="todo" aria-label="Demo steps">
          {steps.map((s, i) => (
            <li key={s.title} data-done={s.done} data-next={i === next}>
              <span className="mark" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
              <div>
                <h3>{s.title}{s.done && <span className="sr-only"> (done)</span>}</h3>
                <p>{s.body}</p>
              </div>
              <button className={`btn btn-small ${i === next ? "" : "btn-secondary"}`} onClick={s.onClick}>{s.label}</button>
            </li>
          ))}
        </ol>

        <aside className="card-sunk">
          <h3 style={{ marginBottom: 14 }}>Good to know</h3>
          <p className="small">
            <strong>Roles are pretend.</strong> “Viewing as” lets you act as anyone so you can see both sides approve. It isn’t a sign-in.
          </p>
          <p className="small">
            <strong>Nothing is really sent.</strong> Emails and calendar invites are recorded, not delivered.
          </p>
          <p className="small">
            <strong>Start over any time</strong> with “Reset demo data” in the bar above.
          </p>
          <p className="small" style={{ marginBottom: 0 }}>
            Also try <button className="linklike" onClick={go("/onboard/alumni", { kind: "coordinator" })}>adding an alum</button> to see capacity change who gets matched.
          </p>
        </aside>
      </div>
    </div>
  );
}
