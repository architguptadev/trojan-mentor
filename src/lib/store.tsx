"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSeedState, SCHEMA_VERSION } from "@/domain/seed";
import { DomainError } from "@/domain/workflow";
import type { AppState } from "@/domain/types";

/**
 * Demo persistence: the whole application state lives in this browser's localStorage.
 * It is not shared across devices or browsers and is never sent to a server.
 */
export const STORAGE_KEY = "trojan-mentor:state";
export const ROLE_KEY = "trojan-mentor:role";

export type Role = { kind: "coordinator" } | { kind: "student"; id: string } | { kind: "mentor"; id: string };

interface Ctx {
  ready: boolean;
  state: AppState;
  role: Role;
  setRole: (r: Role) => void;
  /** Apply a pure domain transition. Domain errors are surfaced as a message, not thrown. */
  apply: (fn: (s: AppState) => AppState, success?: string) => boolean;
  reset: () => void;
  message: { tone: "ok" | "error"; text: string; id: number } | null;
  notify: (tone: "ok" | "error", text: string) => void;
  storageOk: boolean;
}

const AppContext = createContext<Ctx | null>(null);

function load(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.students)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createSeedState("2026-11-14T08:00:00.000Z"));
  const [role, setRoleState] = useState<Role>({ kind: "coordinator" });
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [message, setMessage] = useState<Ctx["message"]>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const loaded = load();
    const initial = loaded ?? createSeedState();
    setState(initial);
    try {
      const r = window.localStorage.getItem(ROLE_KEY);
      if (r) setRoleState(JSON.parse(r));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {
      setStorageOk(false);
    }
    setReady(true);
  }, []);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = load();
        if (next) setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: AppState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageOk(false);
    }
  }, []);

  const notify = useCallback((tone: "ok" | "error", text: string) => setMessage({ tone, text, id: Date.now() }), []);

  const apply = useCallback(
    (fn: (s: AppState) => AppState, success?: string) => {
      try {
        const next = fn(stateRef.current);
        persist(next);
        if (success) notify("ok", success);
        return true;
      } catch (e) {
        notify("error", e instanceof DomainError ? e.message : "Something went wrong. Your data was not changed.");
        if (!(e instanceof DomainError)) console.error(e);
        return false;
      }
    },
    [persist, notify],
  );

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      window.localStorage.setItem(ROLE_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    const fresh = createSeedState();
    persist(fresh);
    setRole({ kind: "coordinator" });
    notify("ok", "Demo reset. All locally stored data was replaced with the fictional starting cohort.");
  }, [persist, setRole, notify]);

  // If the role points at a person who no longer exists, fall back to coordinator.
  const safeRole = useMemo<Role>(() => {
    if (role.kind === "student" && !state.students.some((s) => s.id === role.id)) return { kind: "coordinator" };
    if (role.kind === "mentor" && !state.mentors.some((m) => m.id === role.id)) return { kind: "coordinator" };
    return role;
  }, [role, state]);

  const value = useMemo(
    () => ({ ready, state, role: safeRole, setRole, apply, reset, message, notify, storageOk }),
    [ready, state, safeRole, setRole, apply, reset, message, notify, storageOk],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export function roleLabel(state: AppState, r: Role) {
  if (r.kind === "coordinator") return "Program coordinator";
  if (r.kind === "student") return state.students.find((s) => s.id === r.id)?.name ?? "Student";
  return state.mentors.find((m) => m.id === r.id)?.name ?? "Mentor";
}

export function actorId(r: Role) {
  return r.kind === "coordinator" ? "coordinator" : r.id;
}
