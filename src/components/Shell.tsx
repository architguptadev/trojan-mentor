"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Mark } from "./Mark";
import { roleLabel, useApp, type Role } from "@/lib/store";
import { inboxFor } from "@/domain/inbox";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, role, ready } = useApp();
  const waiting = ready ? inboxFor(state, role).length : 0;

  const nav = [
    { href: "/home", label: "Home", count: waiting },
    { href: "/matches", label: role.kind === "coordinator" ? "Matches" : "My matches" },
    ...(role.kind === "coordinator" ? [{ href: "/cohort", label: "Cohort" }, { href: "/dashboard", label: "Dashboard" }] : [{ href: "/profile", label: "Profile" }]),
  ];

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="page">
          <Link href="/" className="brand" aria-label="Trojan Mentor home">
            <Mark size={24} />
            <span className="brand-word">Trojan Mentor</span>
          </Link>
          <span className="env-note">Demo environment</span>
          <nav aria-label="Main" className="nav">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}>
                {n.label}
                {!!n.count && <span className="count" aria-label={`${n.count} waiting`}>{n.count}</span>}
              </Link>
            ))}
          </nav>
          <AccountSwitcher />
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <Toast />
      <span className="sr-only" aria-live="polite">{ready ? `Signed in as ${roleLabel(state, role)}` : ""}</span>
    </>
  );
}

function AccountSwitcher() {
  const { state, role, setRole, ready } = useApp();
  const router = useRouter();
  const id = useId();
  const value = role.kind === "coordinator" ? "coordinator" : `${role.kind}:${role.id}`;
  return (
    <div className="account">
      <label htmlFor={id} className="muted">Signed in as<span className="sr-only"> (demo account)</span></label>
      <select
        id={id}
        value={value}
        disabled={!ready}
        title="Demo accounts: switch freely. There’s no real sign-in."
        onChange={(e) => {
          const v = e.target.value;
          if (v === "new:student") return router.push("/onboard/student");
          if (v === "new:mentor") return router.push("/onboard/alumni");
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
        <optgroup label="Join">
          <option value="new:student">New student profile…</option>
          <option value="new:mentor">New alum profile…</option>
        </optgroup>
      </select>
    </div>
  );
}

function Footer() {
  const { reset } = useApp();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <footer className="site-footer">
      <div className="page">
        <p>
          Trojan Mentor is an independent student project from the AI@USC hackathon, November 2026. It isn’t affiliated with or
          endorsed by the University of Southern California and connects to no university systems. This is a demo: every person is
          fictional, accounts switch without a password, and data stays in your browser.
        </p>
        <div className="stack" style={{ ["--stack" as string]: "6px" }}>
          <p className="row" style={{ gap: 16 }}>
            <Link href="/how-it-works">How matching works</Link>
            <Link href="/privacy">Privacy and your data</Link>
          </p>
          <p className="row" style={{ gap: 10 }}>
            {confirming ? (
              <>
                <span>Start over with the original cohort?</span>
                <button className="linklike" onClick={() => { reset(); setConfirming(false); router.push("/home"); }}>Yes, reset</button>
                <button className="linklike" onClick={() => setConfirming(false)}>Cancel</button>
              </>
            ) : (
              <button className="linklike" onClick={() => setConfirming(true)}>Reset demo data</button>
            )}
          </p>
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
          <button onClick={() => setVisible(null)} aria-label="Dismiss message">✕</button>
        </div>
      )}
    </div>
  );
}
