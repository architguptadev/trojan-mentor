"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Mark } from "./Mark";
import { roleLabel, useApp, type Role } from "@/lib/store";
import { inboxFor } from "@/domain/inbox";

const NAV = [
  { href: "/demo", label: "Demo" },
  { href: "/onboard/student", label: "For students" },
  { href: "/onboard/alumni", label: "For alumni" },
  { href: "/cohort", label: "Cohort" },
  { href: "/matches", label: "Matches" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  useEffect(() => setOpen(false), [pathname]);
  const isLanding = pathname === "/";

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="page">
          <Link href="/" className="brand" aria-label="Trojan Mentor home">
            <Mark />
            <span className="brand-word">Trojan Mentor</span>
          </Link>
          <button className="btn btn-secondary btn-small menu-btn" aria-expanded={open} aria-controls={navId} onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Menu"}
          </button>
          <nav id={navId} className="nav" aria-label="Main" data-open={open}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {!isLanding && <DemoBar />}
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <Toast />
    </>
  );
}

function DemoBar() {
  const { state, role, setRole, ready, reset } = useApp();
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const value = role.kind === "coordinator" ? "coordinator" : `${role.kind}:${role.id}`;
  const waiting = ready ? inboxFor(state, role).length : 0;
  return (
    <div className="demo-bar" role="region" aria-label="Demo controls">
      <div className="page">
        <label htmlFor={id}>Viewing as</label>
        <select
          id={id}
          value={value}
          disabled={!ready}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "coordinator") return setRole({ kind: "coordinator" });
            const [kind, pid] = v.split(":");
            setRole({ kind: kind as "student" | "mentor", id: pid } as Role);
          }}
        >
          <option value="coordinator">Program coordinator</option>
          <optgroup label="Students">
            {state.students.map((s) => <option key={s.id} value={`student:${s.id}`}>{s.name}</option>)}
          </optgroup>
          <optgroup label="Alumni">
            {state.mentors.map((m) => <option key={m.id} value={`mentor:${m.id}`}>{m.name}</option>)}
          </optgroup>
        </select>
        {ready && (
          <Link href="/matches" className={waiting ? "waiting" : "quiet"}>
            {waiting ? `${waiting} waiting on you` : "Nothing waiting on you"}
          </Link>
        )}
        <span className="spacer" />
        <span className="quiet hide-sm">Demo roles, no sign-in. Fictional people, stored in this browser.</span>
        {confirming ? (
          <span className="row" style={{ gap: 10 }}>
            <span>Start over?</span>
            <button className="linklike" onClick={() => { reset(); setConfirming(false); }}>Yes, reset</button>
            <button className="linklike" onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button className="linklike" onClick={() => setConfirming(true)}>Reset demo data</button>
        )}
        <span className="sr-only" aria-live="polite">Now viewing as {roleLabel(state, role)}</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="page">
        <p>
          Trojan Mentor is an independent student project from the AI@USC hackathon, November 2026. It isn’t affiliated with or
          endorsed by the University of Southern California and connects to no university systems. Everyone in the demo is fictional.
        </p>
        <p className="row" style={{ gap: 16 }}>
          <Link href="/how-it-works">How matching works</Link>
          <Link href="/privacy">Privacy and your data</Link>
        </p>
      </div>
    </footer>
  );
}

function Toast() {
  const { message } = useApp();
  const [visible, setVisible] = useState<typeof message>(null);
  useEffect(() => {
    if (!message) return;
    setVisible(message);
    const t = setTimeout(() => setVisible(null), message.tone === "error" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div aria-live="polite" role="status">
      {visible && (
        <div className="toast" data-tone={visible.tone}>
          <span>{visible.text}</span>
          <button onClick={() => setVisible(null)} aria-label="Dismiss message">✕</button>
        </div>
      )}
    </div>
  );
}
