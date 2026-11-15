"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { actorId, useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { ListField, SlotPicker, TextField } from "@/components/fields";
import { USC_SCHOOLS } from "@/lib/extraction/schema";
import { updateMentorProfile, updateStudentProfile, type MentorEditable, type StudentEditable } from "@/domain/workflow";
import type { MentorProfile, StudentProfile } from "@/domain/types";

export default function ProfilePage() {
  const { state, ready, role } = useApp();
  if (!ready) return <Loading />;
  const s = role.kind === "student" ? state.students.find((x) => x.id === role.id) : undefined;
  const m = role.kind === "mentor" ? state.mentors.find((x) => x.id === role.id) : undefined;
  if (s) return <StudentForm key={s.id} s={s} />;
  if (m) return <MentorForm key={m.id} m={m} />;
  return (
    <div className="page">
      <header className="page-head">
        <h1>Coordinators don’t have a profile</h1>
        <p className="lede">Switch to a student or alum account to edit their profile, or add someone new.</p>
      </header>
      <div className="row">
        <Link className="btn" href="/onboard/student">New student profile</Link>
        <Link className="btn btn-secondary" href="/onboard/alumni">New alum profile</Link>
      </div>
    </div>
  );
}

function SchoolSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>USC school</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {!USC_SCHOOLS.some((x) => x.name === value) && <option value={value}>{value || "Choose a school…"}</option>}
        {USC_SCHOOLS.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
      </select>
    </div>
  );
}

function SaveBar({ onSave, note }: { onSave: () => void; note: string }) {
  return (
    <aside className="card stack" style={{ position: "sticky", top: 90, ["--stack" as string]: "12px" }}>
      <h3>Save changes</h3>
      <p className="small muted" style={{ margin: 0 }}>{note}</p>
      <div className="row">
        <button className="btn" onClick={onSave}>Save changes</button>
        <Link className="btn btn-quiet" href="/home">Cancel</Link>
      </div>
    </aside>
  );
}

function StudentForm({ s }: { s: StudentProfile }) {
  const { apply, role, state } = useApp();
  const router = useRouter();
  const [f, setF] = useState<StudentEditable>({
    name: s.name, school: s.school, program: s.program, gradYear: s.gradYear, careerGoals: s.careerGoals,
    targetRoles: s.targetRoles, industries: s.industries, skills: s.skills, interests: s.interests,
    communities: s.communities, availability: s.availability, excludeMentorIds: s.excludeMentorIds,
  });
  const set = <K extends keyof StudentEditable>(k: K, v: StudentEditable[K]) => setF({ ...f, [k]: v });
  const yearId = useId();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Your profile</h1>
        <p className="lede">Keep this current. Mentors see your goal, and matching uses everything here.</p>
      </header>
      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          <div className="grid-2">
            <TextField label="Full name" value={f.name} onChange={(v) => set("name", v)} maxLength={80} />
            <SchoolSelect value={f.school} onChange={(v) => set("school", v)} />
          </div>
          <div className="grid-2">
            <TextField label="Program" value={f.program} onChange={(v) => set("program", v)} maxLength={120} />
            <div className="field">
              <label htmlFor={yearId}>Graduation year</label>
              <input id={yearId} type="number" min={2020} max={2034} value={f.gradYear} onChange={(e) => set("gradYear", Number(e.target.value) || f.gradYear)} />
            </div>
          </div>
          <TextField label="Career goals" value={f.careerGoals} onChange={(v) => set("careerGoals", v)} multiline />
          <div className="grid-2">
            <ListField label="Target roles" value={f.targetRoles} onChange={(v) => set("targetRoles", v)} />
            <ListField label="Industries" value={f.industries} onChange={(v) => set("industries", v)} />
          </div>
          <div className="grid-2">
            <ListField label="Skills" value={f.skills} onChange={(v) => set("skills", v)} />
            <ListField label="Interests" value={f.interests} onChange={(v) => set("interests", v)} />
          </div>
          <ListField label="Communities" value={f.communities} onChange={(v) => set("communities", v)} hint="Optional, e.g. transfer student, club sports." />
          <SlotPicker legend="When are you usually free?" value={f.availability} onChange={(v) => set("availability", v)} />
          <fieldset>
            <legend>Anyone you’d prefer not to be matched with?</legend>
            <div className="row" style={{ gap: "6px 18px", marginTop: 8 }}>
              {state.mentors.map((m) => (
                <label key={m.id} className="small row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={f.excludeMentorIds.includes(m.id)} onChange={(e) => set("excludeMentorIds", e.target.checked ? [...f.excludeMentorIds, m.id] : f.excludeMentorIds.filter((x) => x !== m.id))} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <SaveBar
          note="Changes apply from the next matching round. A match you’ve already approved stays as it is."
          onSave={() => { if (apply((st) => updateStudentProfile(st, s.id, actorId(role), f), "Profile saved.")) router.push("/home"); }}
        />
      </div>
    </div>
  );
}

function MentorForm({ m }: { m: MentorProfile }) {
  const { apply, role, state } = useApp();
  const router = useRouter();
  const [f, setF] = useState<MentorEditable>({
    name: m.name, headline: m.headline, school: m.school, gradYear: m.gradYear, trajectory: m.trajectory,
    industries: m.industries, roles: m.roles, expertise: m.expertise, communities: m.communities,
    mentoringPreferences: m.mentoringPreferences, availability: m.availability, capacity: m.capacity, excludeStudentIds: m.excludeStudentIds,
  });
  const set = <K extends keyof MentorEditable>(k: K, v: MentorEditable[K]) => setF({ ...f, [k]: v });
  const capId = useId();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Your mentor profile</h1>
        <p className="lede">Students read this before your first conversation.</p>
      </header>
      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          <div className="grid-2">
            <TextField label="Full name" value={f.name} onChange={(v) => set("name", v)} maxLength={80} />
            <TextField label="What you do now" value={f.headline} onChange={(v) => set("headline", v)} maxLength={120} />
          </div>
          <div className="grid-2">
            <SchoolSelect value={f.school} onChange={(v) => set("school", v)} />
            <div className="field">
              <label htmlFor={capId}>Students you can take</label>
              <select id={capId} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <ListField label="Roles you’ve held" value={f.roles} onChange={(v) => set("roles", v)} />
            <ListField label="Industries" value={f.industries} onChange={(v) => set("industries", v)} />
          </div>
          <div className="grid-2">
            <ListField label="What you can help with" value={f.expertise} onChange={(v) => set("expertise", v)} />
            <ListField label="Communities" value={f.communities} onChange={(v) => set("communities", v)} />
          </div>
          <TextField label="How you like to mentor" value={f.mentoringPreferences} onChange={(v) => set("mentoringPreferences", v)} multiline />
          <SlotPicker legend="When are you usually free?" value={f.availability} onChange={(v) => set("availability", v)} />
          <fieldset>
            <legend>Anyone you shouldn’t be matched with?</legend>
            <div className="row" style={{ gap: "6px 18px", marginTop: 8 }}>
              {state.students.map((s) => (
                <label key={s.id} className="small row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={f.excludeStudentIds.includes(s.id)} onChange={(e) => set("excludeStudentIds", e.target.checked ? [...f.excludeStudentIds, s.id] : f.excludeStudentIds.filter((x) => x !== s.id))} />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <SaveBar
          note="Changes apply from the next matching round. Students you’re already mentoring stay with you."
          onSave={() => { if (apply((st) => updateMentorProfile(st, m.id, actorId(role), f), "Profile saved.")) router.push("/home"); }}
        />
      </div>
    </div>
  );
}
