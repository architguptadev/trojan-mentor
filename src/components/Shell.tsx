"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Mark } from "./Mark";
import { roleLabel, useApp, type Role } from "@/lib/store";

const NAV = [
  { href: "/demo", label: "Guided demo" },
  { href: "/onboard/student", label: "Student onboarding" },
  { href: "/onboard/alumni", label: "Alumni onboarding" },
  { href: "/cohort", label: "Cohort" },
  { href: "/matches", label: "Matches" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/privacy", label: "Privacy & data" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  useEffect(() => setOpen(false), [pathname]);
  const isLanding = pathname === "/";

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <DemoStrip />
      <header className="site-header">
        <div className="page" style={{ position: "relative" }}>
          <Link href="/" className="brand" aria-label="Trojan Mentor home">
            <Mark />
            <span className="brand-word">
              Trojan <em>Mentor</em>
            </span>
          </Link>
          <button
            className="btn btn-secondary btn-small menu-btn"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close menu" : "Menu"}
          </button>
          <nav id={navId} className="nav" aria-label="Main" data-open={open}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href + "/")) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {!isLanding && <RoleBar />}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <Toast />
    </>
  );
}

function DemoStrip() {
  const { reset } = useApp();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="demo-strip" role="region" aria-label="Demo notice">
      <div className="page">
        <span>
          <strong>Demo mode.</strong> Every person is fictional. Data stays in this browser only.
        </span>
        <span className="row" style={{ gap: 10 }}>
          {confirming ? (
            <>
              <span>Replace all local data with the starting cohort?</span>
              <button className="linklike" onClick={() => { reset(); setConfirming(false); }}>
                Yes, reset
              </button>
              <button className="linklike" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="linklike" onClick={() => setConfirming(true)}>
              Reset demo data
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

function RoleBar() {
  const { state, role, setRole, ready } = useApp();
  const id = useId();
  const value = role.kind === "coordinator" ? "coordinator" : `${role.kind}:${role.id}`;
  return (
    <div className="role-bar" role="region" aria-label="Simulated role">
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
            {state.students.map((s) => (
              <option key={s.id} value={`student:${s.id}`}>
                {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Alumni mentors">
            {state.mentors.map((m) => (
              <option key={m.id} value={`mentor:${m.id}`}>
                {m.name}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="tag tag-sim">Simulated role</span>
        <span className="small" style={{ color: "var(--gold-ink)" }}>
          Switching roles is a demo convenience, not sign-in. It provides no real authentication.
        </span>
        <span className="sr-only" aria-live="polite">
          Now viewing as {roleLabel(state, role)}
        </span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="page">
        <div>
          <p className="serif" style={{ fontSize: "1.1rem", color: "var(--ink)", marginBottom: 6 }}>
            Trojan Mentor
          </p>
          <p style={{ marginBottom: 6 }}>
            An independent student project built at the AI@USC hackathon, November 14–15, 2026. Not affiliated with,
            sponsored by, or endorsed by the University of Southern California. No university systems or alumni databases are connected.
          </p>
        </div>
        <div>
          <p style={{ marginBottom: 6 }}>
            <Link href="/how-it-works">How matching works</Link> · <Link href="/privacy">Privacy & data</Link>
          </p>
          <p>All people and organizations shown are fictional. Metrics reflect only this browser’s demo data.</p>
        </div>
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
          <button onClick={() => setVisible(null)} aria-label="Dismiss message">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
