"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { ListField, SlotPicker, TextField } from "@/components/fields";
import { USC_SCHOOLS } from "@/lib/extraction/schema";
import { runAllocation } from "@/domain/cohort";
import type { MentorProfile, Slot } from "@/domain/types";

export default function AlumniOnboarding() {
  const { ready, apply, setRole, state } = useApp();
  const router = useRouter();
  const [f, setF] = useState({
    name: "",
    headline: "",
    school: "",
    gradYear: "",
    trajectory: [{ role: "", org: "", years: "" }],
    industries: [] as string[],
    roles: [] as string[],
    expertise: [] as string[],
    communities: [] as string[],
    mentoringPreferences: "",
    capacity: 1,
  });
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [visibility, setVisibility] = useState<"visible" | "paused">("visible");
  const [consent, setConsent] = useState({ profileProcessing: false, matching: true });
  const [exclude, setExclude] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
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
  if (!consent.profileProcessing) errors.push("Agree to save your profile.");

  const saved = savedId ? state.mentors.find((m) => m.id === savedId) : null;
  if (saved)
    return (
      <div className="page">
        <header className="page-head">
          <h1>Thank you, {saved.name.split(" ")[0]}</h1>
          <p className="lede">
            You’re signed up with room for {saved.capacity} student{saved.capacity > 1 ? "s" : ""}, and your profile is{" "}
            {saved.visibility === "visible" && saved.consent.matching ? "open to new matches" : "paused for now"}. You’ll approve any match yourself.
          </p>
        </header>
        <div className="row">
          <button className="btn" onClick={() => { apply((s) => runAllocation(s), "Cohort matched again with your capacity included."); router.push("/cohort"); }}>
            Match the cohort again
          </button>
          <button className="btn btn-secondary" onClick={() => { setRole({ kind: "mentor", id: saved.id }); router.push("/matches"); }}>
            View as {saved.name.split(" ")[0]}
          </button>
        </div>
      </div>
    );

  return (
    <div className="page">
      <header className="page-head">
        
        <h1>Be the conversation you wish you’d had</h1>
        <p className="lede">Choose how many students you can take. You’ll approve every match before anyone is introduced, and you can pause whenever you need to.</p>
      </header>

      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          <div className="grid-2">
            <TextField label="Full name" value={f.name} onChange={(v) => set("name", v)} required invalid={tried && !f.name.trim()} maxLength={80} />
            <TextField label="What you do now" value={f.headline} onChange={(v) => set("headline", v)} hint="e.g. Product lead, a health-tech company" maxLength={120} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={schoolId}>USC school <span className="muted">(required)</span></label>
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

          <fieldset className="choices">
            <legend>Your path so far</legend>
            <p className="hint" style={{ margin: "4px 0 10px" }}>Oldest first. Students use this to prepare questions.</p>
            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              {f.trajectory.map((t, i) => (
                <div key={i} className="grid-3" style={{ gap: 10 }}>
                  <TextField label={`Role ${i + 1}`} value={t.role} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, role: v } : x)))} maxLength={80} />
                  <TextField label="Organization" value={t.org} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, org: v } : x)))} maxLength={80} />
                  <TextField label="Years" value={t.years} onChange={(v) => set("trajectory", f.trajectory.map((x, j) => (j === i ? { ...x, years: v } : x)))} maxLength={20} />
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {f.trajectory.length < 5 && <button className="btn btn-small btn-quiet" onClick={() => set("trajectory", [...f.trajectory, { role: "", org: "", years: "" }])}>+ Add a role</button>}
              {f.trajectory.length > 1 && <button className="btn btn-small btn-quiet" onClick={() => set("trajectory", f.trajectory.slice(0, -1))}>Remove last</button>}
            </div>
          </fieldset>

          <div className="grid-2">
            <ListField label="Roles you’ve held" value={f.roles} onChange={(v) => set("roles", v)} invalid={tried && f.roles.length + f.industries.length === 0} />
            <ListField label="Industries" value={f.industries} onChange={(v) => set("industries", v)} />
          </div>
          <div className="grid-2">
            <ListField label="What you can help with" value={f.expertise} onChange={(v) => set("expertise", v)} required invalid={tried && f.expertise.length === 0} />
            <ListField label="Communities" value={f.communities} onChange={(v) => set("communities", v)} hint="Optional, e.g. first-generation college student." />
          </div>
          <TextField label="How you like to mentor" value={f.mentoringPreferences} onChange={(v) => set("mentoringPreferences", v)} multiline hint="Who you’d most like to help, and how often you’d like to meet." />
          <SlotPicker legend="When are you usually free?" value={availability} onChange={setAvailability} invalid={tried && availability.length === 0} />
          <fieldset className="choices">
            <legend>Anyone you shouldn’t be matched with?</legend>
            <p className="hint" style={{ margin: "4px 0 8px" }}>Optional. For example, someone you manage or are related to.</p>
            <div className="row" style={{ gap: "6px 18px" }}>
              {state.students.map((s) => (
                <label key={s.id} className="small row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={exclude.includes(s.id)} onChange={(e) => setExclude(e.target.checked ? [...exclude, s.id] : exclude.filter((x) => x !== s.id))} />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="card stack" style={{ position: "sticky", top: 90 }}>
          <h3>Your availability as a mentor</h3>
          <div className="field">
            <label htmlFor={capId}>How many students this term?</label>
            <select id={capId} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <fieldset className="choices">
            <legend>Open to new matches?</legend>
            <label className="choice">
              <input type="radio" name="vis" checked={visibility === "visible"} onChange={() => setVisibility("visible")} />
              <span><strong>Yes</strong><span className="hint">You may be suggested to students. You approve each match.</span></span>
            </label>
            <label className="choice">
              <input type="radio" name="vis" checked={visibility === "paused"} onChange={() => setVisibility("paused")} />
              <span><strong>Not right now</strong><span className="hint">Your profile is saved but you won’t be suggested.</span></span>
            </label>
          </fieldset>
          <label className="choice">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span><strong>I want to mentor students through Trojan Mentor</strong><span className="hint">Required. No one is listed as a mentor without saying yes.</span></span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={consent.profileProcessing} onChange={(e) => setConsent({ ...consent, profileProcessing: e.target.checked })} />
            <span><strong>Save my profile</strong><span className="hint">Required. In this demo it stays in this browser.</span></span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={consent.matching} onChange={(e) => setConsent({ ...consent, matching: e.target.checked })} />
            <span><strong>Include me in matching</strong><span className="hint">Turn off to stay signed up without new matches.</span></span>
          </label>
          {tried && errors.length > 0 && (
            <div className="notice notice-error" role="alert">
              <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <button
            className="btn"
            onClick={() => {
              setTried(true);
              if (errors.length) return;
              const at = new Date().toISOString();
              const id = `m-user-${Date.now().toString(36)}`;
              const m: MentorProfile = {
                id,
                kind: "mentor",
                name: f.name.trim(),
                headline: f.headline.trim() || "Alumni mentor",
                school: f.school,
                gradYear: Number(f.gradYear) || 2015,
                trajectory: f.trajectory.filter((t) => t.role.trim()),
                industries: f.industries,
                roles: f.roles,
                expertise: f.expertise,
                communities: f.communities,
                mentoringPreferences: f.mentoringPreferences.trim() || "No preference stated.",
                availability,
                capacity: f.capacity,
                optIn,
                visibility,
                excludeStudentIds: exclude,
                consent: { profileProcessing: true, externalAI: false, matching: consent.matching, version: 1, updatedAt: at },
                fictional: true,
                createdAt: at,
              };
              if (apply((s) => ({ ...s, mentors: [...s.mentors, m], auditLog: [...s.auditLog, { at, message: `${m.name} signed up to mentor (up to ${m.capacity}, ${m.visibility === "visible" ? "open to new students" : "paused"}).` }] }), "Thanks for signing up to mentor.")) { setRole({ kind: "mentor", id }); router.push("/home"); }
            }}
          >
            Sign up to mentor
          </button>
        </aside>
      </div>
    </div>
  );
}
