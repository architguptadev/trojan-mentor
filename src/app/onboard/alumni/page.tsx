"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { ListField, SlotPicker, TextField } from "@/components/fields";
import { USC_SCHOOLS } from "@/lib/extraction/schema";
import type { MentorProfile, Slot } from "@/domain/types";

export default function AlumniOnboarding() {
  const { ready, apply, setRole, state } = useApp();
  const router = useRouter();
  const [f, setF] = useState({
    name: "", headline: "", school: "", gradYear: "",
    trajectory: [{ role: "", org: "", years: "" }],
    industries: [] as string[], roles: [] as string[], expertise: [] as string[], communities: [] as string[],
    mentoringPreferences: "", capacity: 1,
  });
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [open, setOpen] = useState(true);
  const [store, setStore] = useState(false);
  const [matching, setMatching] = useState(true);
  const [exclude, setExclude] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const schoolId = useId();
  const yearId = useId();
  const capId = useId();
  if (!ready) return <Loading />;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Add your name.");
  if (!f.school) errors.push("Choose the USC school you attended.");
  if (f.roles.length + f.industries.length === 0) errors.push("Add at least one role or industry you’ve worked in.");
  if (f.expertise.length === 0) errors.push("Add at least one thing you can help with.");
  if (availability.length === 0) errors.push("Choose at least one time you’re usually free.");
  if (!optIn) errors.push("Confirm you want to mentor.");
  if (!store) errors.push("Agree to save your profile.");

  const save = () => {
    setTried(true);
    if (errors.length) return;
    const at = new Date().toISOString();
    const id = `m-user-${Date.now().toString(36)}`;
    const m: MentorProfile = {
      id, kind: "mentor", name: f.name.trim(), headline: f.headline.trim() || "Alumni mentor", school: f.school,
      gradYear: Number(f.gradYear) || 2015, trajectory: f.trajectory.filter((t) => t.role.trim()),
      industries: f.industries, roles: f.roles, expertise: f.expertise, communities: f.communities,
      mentoringPreferences: f.mentoringPreferences.trim() || "No preference stated.", availability, capacity: f.capacity,
      optIn, visibility: open ? "visible" : "paused", excludeStudentIds: exclude,
      consent: { profileProcessing: true, externalAI: false, matching, version: 1, updatedAt: at }, fictional: true, createdAt: at,
    };
    if (apply((s) => ({ ...s, mentors: [...s.mentors, m], auditLog: [...s.auditLog, { at, message: `${m.name} signed up to mentor (up to ${m.capacity}, ${open ? "open to new students" : "paused"}).` }] }), "Thanks for signing up to mentor.")) {
      setRole({ kind: "mentor", id });
      router.push("/home");
    }
  };

  return (
    <div className="page">
      <div className="narrow" style={{ paddingTop: "clamp(28px, 5vw, 48px)" }}>
        <Link href="/" className="back">← Back</Link>
        <span className="kicker">Mentor profile / 01</span>
        <h1 style={{ marginBottom: 8 }}>Be the conversation you wish you’d had</h1>
        <p className="lede" style={{ marginBottom: 28 }}>Tell students where you’ve been and how you can help. You’ll approve every match before anyone is introduced.</p>

        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          <TextField label="Full name" value={f.name} onChange={(v) => set("name", v)} invalid={tried && !f.name.trim()} maxLength={80} />
          <TextField label="What you do now" value={f.headline} onChange={(v) => set("headline", v)} hint="For example, product lead at a health-tech company." maxLength={120} />
          <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}>
            <div className="field">
              <label htmlFor={schoolId}>USC school</label>
              <select id={schoolId} value={f.school} onChange={(e) => set("school", e.target.value)} aria-invalid={(tried && !f.school) || undefined}>
                <option value="">Choose a school…</option>
                {USC_SCHOOLS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={yearId}>Graduation year</label>
              <input id={yearId} type="number" min={1950} max={2026} value={f.gradYear} onChange={(e) => set("gradYear", e.target.value)} />
            </div>
          </div>

          <fieldset>
            <legend>Your path so far</legend>
            <p className="hint" style={{ margin: "2px 0 10px" }}>Oldest first. Students use this to prepare questions.</p>
            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              {f.trajectory.map((t, i) => (
                <div key={i} className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.8fr)", gap: 8 }}>
                  <TextField label={`Role ${i + 1}`} value={t.role} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, role: v } : x)))} maxLength={80} />
                  <TextField label="Organization" value={t.org} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, org: v } : x)))} maxLength={80} />
                  <TextField label="Years" value={t.years} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, years: v } : x)))} maxLength={20} />
                </div>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 8 }}>
              {f.trajectory.length < 5 && <button className="link small" onClick={() => set("trajectory", [...f.trajectory, { role: "", org: "", years: "" }])}>Add a role</button>}
              {f.trajectory.length > 1 && <button className="link small" onClick={() => set("trajectory", f.trajectory.slice(0, -1))}>Remove the last role</button>}
            </div>
          </fieldset>

          <ListField label="Roles you’ve held" value={f.roles} onChange={(v) => set("roles", v)} invalid={tried && f.roles.length + f.industries.length === 0} />
          <ListField label="Industries" value={f.industries} onChange={(v) => set("industries", v)} />
          <ListField label="What you can help with" value={f.expertise} onChange={(v) => set("expertise", v)} invalid={tried && f.expertise.length === 0} />
          <ListField label="Communities" value={f.communities} onChange={(v) => set("communities", v)} hint="Optional, e.g. first-generation college student." />
          <TextField label="How you like to mentor" value={f.mentoringPreferences} onChange={(v) => set("mentoringPreferences", v)} multiline hint="Who you’d most like to help, and how often you’d like to meet." />
          <SlotPicker legend="When are you usually free?" value={availability} onChange={setAvailability} invalid={tried && availability.length === 0} />
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor={capId}>Students you can take this term</label>
            <select id={capId} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <details className="disclosure">
            <summary>Anyone you shouldn’t be matched with?</summary>
            <fieldset>
              <legend className="sr-only">Students to exclude</legend>
              <div className="checks" style={{ marginTop: 6 }}>
                {state.students.map((s) => (
                  <label key={s.id} className="check">
                    <input type="checkbox" checked={exclude.includes(s.id)} onChange={(e) => setExclude(e.target.checked ? [...exclude, s.id] : exclude.filter((x) => x !== s.id))} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>
        </div>

        <hr className="rule" />
        <fieldset className="checks">
          <legend className="sr-only">Before you sign up</legend>
          <label className="check">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} aria-invalid={(tried && !optIn) || undefined} />
            <span>I want to mentor students through Trojan Mentor <span className="muted">(required)</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={store} onChange={(e) => setStore(e.target.checked)} aria-invalid={(tried && !store) || undefined} />
            <span>Save my profile <span className="muted">(required)</span><span className="hint" style={{ display: "block" }}>In this demo it’s kept only in this browser.</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={matching} onChange={(e) => setMatching(e.target.checked)} />
            <span>Include me in matching<span className="hint" style={{ display: "block" }}>Turn off to stay signed up without being suggested.</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            <span>Open to new students now<span className="hint" style={{ display: "block" }}>You can pause at any time from your home page.</span></span>
          </label>
        </fieldset>
        {tried && errors.length > 0 && (
          <div className="notice notice-error" role="alert" style={{ marginTop: 18 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <div className="actions" style={{ marginTop: 22 }}>
          <button className="btn" onClick={save}>Sign up to mentor</button>
        </div>
      </div>
    </div>
  );
}
