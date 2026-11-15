"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { ListField, SlotPicker, TextField } from "@/components/fields";
import { USC_SCHOOLS, type ExtractedProfile, type ExtractionResponse } from "@/lib/extraction/schema";
import { SAMPLE_RESUME, SAMPLE_RESUME_WITH_INJECTION } from "@/lib/samples";
import type { Slot, StudentProfile } from "@/domain/types";

const MAX_BYTES = 2 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 45000;
const EMPTY: ExtractedProfile = { name: "", school: "", program: "", gradYear: null, careerGoals: "", targetRoles: [], industries: [], skills: [], interests: [], communities: [] };
type Extracted = Extract<ExtractionResponse, { ok: true }>;

export default function StudentOnboarding() {
  const { ready } = useApp();
  const [step, setStep] = useState<"resume" | "review">("resume");
  const [extraction, setExtraction] = useState<Extracted | null>(null);
  const [draft, setDraft] = useState<ExtractedProfile>(EMPTY);
  const [aiConsent, setAiConsent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [step]);
  if (!ready) return <Loading />;

  return (
    <div className="page">
      <div className="narrow" style={{ paddingTop: "clamp(28px, 5vw, 48px)" }}>
        {step === "resume" ? (
          <ResumeStep
            headingRef={headingRef}
            aiConsent={aiConsent}
            setAiConsent={setAiConsent}
            onExtracted={(r) => { setExtraction(r); setDraft(r.profile); setStep("review"); }}
            onManual={() => { setExtraction(null); setDraft(EMPTY); setStep("review"); }}
          />
        ) : (
          <ReviewStep headingRef={headingRef} extraction={extraction} draft={draft} setDraft={setDraft} aiConsent={aiConsent} onBack={() => setStep("resume")} />
        )}
      </div>
    </div>
  );
}

type HRef = React.RefObject<HTMLHeadingElement | null>;

function DocIcon() {
  return (
    <svg className="doc" width="20" height="24" viewBox="0 0 20 24" aria-hidden="true">
      <path d="M3 1.5h9l5.5 5.5v15a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 22V3A1.5 1.5 0 0 1 3 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 1.5V7h5.5M5 12h10M5 15.5h10M5 19h6" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ResumeStep({ headingRef, aiConsent, setAiConsent, onExtracted, onManual }: { headingRef: HRef; aiConsent: boolean; setAiConsent: (v: boolean) => void; onExtracted: (r: Extracted) => void; onManual: () => void }) {
  const [gemini, setGemini] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<{ message: string; canFallback: boolean } | null>(null);
  const fileId = useId();
  const pasteId = useId();
  const tabUpload = useId();
  const tabPaste = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/extract").then((r) => r.json()).then((j) => setGemini(Boolean(j.geminiConfigured))).catch(() => setGemini(false));
    return () => abortRef.current?.abort();
  }, []);

  const useAI = gemini === true && aiConsent;

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setError({ message: `That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. Files must be 2 MB or smaller.`, canFallback: false });
    if (!/\.(pdf|txt|md)$/i.test(f.name)) return setError({ message: "Use a PDF, .txt or .md file.", canFallback: false });
    setFile(f);
  };
  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async (opts: { sample?: string; engine?: "ai" | "demo" } = {}) => {
    const engine = opts.engine ?? (useAI ? "ai" : "demo");
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.set("engine", engine);
      fd.set("externalAIConsent", String(aiConsent));
      if (opts.sample) fd.set("text", opts.sample);
      else if (tab === "upload" && file) fd.set("file", file);
      else if (tab === "paste" && paste.trim()) fd.set("text", paste);
      else {
        setError({ message: tab === "upload" ? "Choose a resume file first." : "Paste your resume text first.", canFallback: false });
        return;
      }
      const res = await fetch("/api/extract", { method: "POST", body: fd, signal: ctrl.signal });
      let json: ExtractionResponse;
      try {
        json = await res.json();
      } catch {
        setError({ message: "The server sent an unreadable response. Try again, or fill in your profile yourself.", canFallback: true });
        return;
      }
      if (json.ok) onExtracted(json);
      else setError({ message: json.message, canFallback: json.canFallback && engine === "ai" });
    } catch (e) {
      setError({ message: (e as Error).name === "AbortError" ? "Reading your resume took too long." : "Couldn’t reach the server. Check your connection and try again.", canFallback: engine === "ai" });
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="resume-title">
      <Link href="/" className="back">← Back</Link>
      <span className="kicker">Profile / 01</span>
      <h1 id="resume-title" ref={headingRef} tabIndex={-1} style={{ marginBottom: 8 }}>Start with your resume</h1>
      <p className="lede" style={{ marginBottom: 20 }}>We’ll use it to fill in your profile, and you’ll review every detail before anything is saved.</p>

      <p className="status-line" data-ai={useAI} aria-live="polite">
        {gemini === null
          ? "Checking how your resume can be read…"
          : useAI
            ? "AI extraction · Google Gemini, with your permission"
            : "Demo extraction · local text parser"}
      </p>

      {gemini && (
        <label className="check" style={{ margin: "14px 0 4px" }}>
          <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
          <span>
            Let Google’s Gemini read my resume
            <span className="hint" style={{ display: "block" }}>Your file is sent to Google for this one reading. Leave this off to use the local parser instead.</span>
          </span>
        </label>
      )}

      <div className="tabs" role="tablist" aria-label="How to add your resume" style={{ marginTop: 22 }}>
        <button role="tab" id={tabUpload} aria-selected={tab === "upload"} aria-controls={`${tabUpload}-panel`} onClick={() => setTab("upload")}>Upload file</button>
        <button role="tab" id={tabPaste} aria-selected={tab === "paste"} aria-controls={`${tabPaste}-panel`} onClick={() => setTab("paste")}>Paste text</button>
      </div>

      {tab === "upload" ? (
        <div id={`${tabUpload}-panel`} role="tabpanel" aria-labelledby={tabUpload}>
          <div
            className="upload-row"
            data-drag={drag}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null); }}
          >
            <DocIcon />
            <div className="meta">
              <strong>{file ? file.name : "No file chosen"}</strong>
              <span>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "PDF, TXT or MD, up to 2\u00a0MB"}</span>
            </div>
            <input ref={inputRef} id={fileId} className="sr-only file-input" type="file" aria-label="Upload a resume" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <label htmlFor={fileId} className="btn btn-secondary btn-small" style={{ cursor: "pointer" }}>{file ? "Replace" : "Choose resume"}</label>
            {file && <button className="link small" onClick={clearFile}>Remove</button>}
          </div>
        </div>
      ) : (
        <div id={`${tabPaste}-panel`} role="tabpanel" aria-labelledby={tabPaste} className="field">
          <label htmlFor={pasteId} className="sr-only">Resume text</label>
          <textarea id={pasteId} value={paste} maxLength={30000} onChange={(e) => setPaste(e.target.value)} placeholder="Paste your resume here" style={{ minHeight: 200 }} />
        </div>
      )}

      {error && (
        <div className="notice notice-error" role="alert" style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 6px" }}>{error.message}</p>
          <div className="actions" style={{ gap: 14 }}>
            {error.canFallback && <button className="link small" onClick={() => submit({ engine: "demo" })}>Use the local parser instead</button>}
            <button className="link small" onClick={onManual}>Fill in my profile myself</button>
          </div>
        </div>
      )}

      <div className="actions" style={{ marginTop: 24 }}>
        <button className="btn" onClick={() => submit()} disabled={busy} aria-busy={busy}>{busy ? "Reading…" : "Review profile"}</button>
        <button className="link" onClick={() => submit({ sample: SAMPLE_RESUME })} disabled={busy}>Try a sample resume</button>
      </div>
      <p className="small muted" style={{ marginTop: 14, maxWidth: "58ch" }}>
        Your resume is read once on our server to fill in the form, then discarded.
        {useAI ? " With your permission, it’s also sent to Google’s Gemini for that reading." : ""} Nothing is saved until you review it,
        and in this demo your profile is kept only in this browser.
      </p>

      <details className="disclosure" style={{ marginTop: 18 }}>
        <summary>How your resume is processed</summary>
        <div className="stack small" style={{ ["--stack" as string]: "8px" }}>
          <p style={{ margin: 0 }}>
            <strong>Local text parser (not AI).</strong> Reads lines like “Skills: …” and common headings such as SKILLS or OBJECTIVE, and
            matches a short list of known terms. It can’t read scanned images.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Google Gemini (AI).</strong>{" "}
            {gemini ? "Available here, and used only if you turn it on above." : "Not configured on this server."} The file is treated as data: any
            instructions inside it are ignored, flagged and left out, and the result is checked before you see it.
          </p>
          <p style={{ margin: 0 }}>
            Samples to try: <a href="/samples/sample-resume-fictional.pdf">PDF resume</a>, <a href="/samples/sample-resume-fictional.txt">text resume</a>, or{" "}
            <button className="link" onClick={() => submit({ sample: SAMPLE_RESUME_WITH_INJECTION })} disabled={busy}>a resume that hides instructions</button>.
          </p>
        </div>
      </details>
    </section>
  );
}

function ReviewStep({ headingRef, extraction, draft, setDraft, aiConsent, onBack }: { headingRef: HRef; extraction: Extracted | null; draft: ExtractedProfile; setDraft: (d: ExtractedProfile) => void; aiConsent: boolean; onBack: () => void }) {
  const { state, apply, setRole } = useApp();
  const router = useRouter();
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [store, setStore] = useState(false);
  const [matching, setMatching] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [tried, setTried] = useState(false);
  const schoolId = useId();
  const yearId = useId();
  const set = <K extends keyof ExtractedProfile>(k: K, v: ExtractedProfile[K]) => setDraft({ ...draft, [k]: v });

  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Add your name.");
  if (!draft.school) errors.push("Choose your USC school.");
  if (!draft.careerGoals.trim()) errors.push("Describe your career goals.");
  if (draft.targetRoles.length + draft.industries.length === 0) errors.push("Add at least one target role or industry.");
  if (availability.length === 0) errors.push("Choose at least one time you’re usually free.");
  if (!store) errors.push("Agree to save your profile.");
  if (!reviewed) errors.push("Confirm you’ve checked every detail.");
  const knownSchool = USC_SCHOOLS.some((s) => s.name === draft.school);

  const save = () => {
    setTried(true);
    if (errors.length) return;
    const at = new Date().toISOString();
    const id = `s-user-${Date.now().toString(36)}`;
    const student: StudentProfile = {
      id, kind: "student", name: draft.name.trim(), school: draft.school, program: draft.program.trim(),
      gradYear: draft.gradYear ?? new Date().getFullYear() + 1, careerGoals: draft.careerGoals.trim(),
      targetRoles: draft.targetRoles, industries: draft.industries, skills: draft.skills, interests: draft.interests,
      communities: draft.communities, availability, excludeMentorIds: exclude,
      consent: { profileProcessing: true, externalAI: aiConsent, matching, version: 1, updatedAt: at },
      fictional: true, source: extraction ? extraction.engine : "manual", reviewedAt: at, createdAt: at,
    };
    const ok = apply(
      (s) => ({ ...s, students: [...s.students, student], auditLog: [...s.auditLog, { at, message: `${student.name} joined (details checked; read by ${student.source === "gemini" ? "Gemini" : student.source === "demo-parser" ? "the local parser" : "hand"}).` }] }),
      "Welcome to Trojan Mentor. Your resume file wasn’t kept.",
    );
    if (ok) {
      setRole({ kind: "student", id });
      router.push("/home");
    }
  };

  return (
    <section aria-labelledby="review-title">
      <button className="back" onClick={onBack}>← Back to resume</button>
      <span className="kicker">Profile / 02</span>
      <h1 id="review-title" ref={headingRef} tabIndex={-1} style={{ marginBottom: 8 }}>Check your details</h1>
      <p className="lede" style={{ marginBottom: 14 }}>Fix anything that’s wrong. Matching uses only what you confirm here.</p>
      <p className="status-line" data-ai={extraction?.engine === "gemini"}>
        {extraction ? (extraction.engine === "gemini" ? "Read by Google Gemini (AI)" : "Read by the local text parser (not AI)") : "Entered by hand"}
      </p>
      {extraction?.warnings.map((w) => <p key={w} className="notice notice-warn" role="alert" style={{ marginTop: 12 }}>{w}</p>)}

      <div className="stack" style={{ ["--stack" as string]: "18px", marginTop: 24 }}>
        <TextField label="Full name" value={draft.name} onChange={(v) => set("name", v)} invalid={tried && !draft.name.trim()} maxLength={80} />
        <div className="field">
          <label htmlFor={schoolId}>USC school</label>
          <select id={schoolId} value={draft.school} onChange={(e) => set("school", e.target.value)} aria-invalid={(tried && !draft.school) || undefined}>
            <option value="">Choose a school…</option>
            {!knownSchool && draft.school && <option value={draft.school}>{draft.school} (as read)</option>}
            {USC_SCHOOLS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}>
          <TextField label="Program" value={draft.program} onChange={(v) => set("program", v)} maxLength={120} />
          <div className="field">
            <label htmlFor={yearId}>Graduation year</label>
            <input id={yearId} type="number" min={2020} max={2034} value={draft.gradYear ?? ""} onChange={(e) => set("gradYear", e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <TextField label="Career goals" value={draft.careerGoals} onChange={(v) => set("careerGoals", v)} multiline invalid={tried && !draft.careerGoals.trim()} hint="In your own words. Your mentor will read this." />
        <ListField label="Target roles" value={draft.targetRoles} onChange={(v) => set("targetRoles", v)} invalid={tried && draft.targetRoles.length + draft.industries.length === 0} />
        <ListField label="Industries" value={draft.industries} onChange={(v) => set("industries", v)} />
        <ListField label="Skills" value={draft.skills} onChange={(v) => set("skills", v)} />
        <ListField label="Interests" value={draft.interests} onChange={(v) => set("interests", v)} />
        <ListField label="USC communities" value={draft.communities} onChange={(v) => set("communities", v)} hint="Optional. Groups you choose to share, e.g. transfer student, club sports." />
        <SlotPicker legend="When are you usually free?" hint="Used only to find times that suit you and a mentor." value={availability} onChange={setAvailability} invalid={tried && availability.length === 0} />
        <details className="disclosure">
          <summary>Anyone you’d prefer not to be matched with?</summary>
          <fieldset>
            <legend className="sr-only">Alumni to exclude</legend>
            <div className="checks" style={{ marginTop: 6 }}>
              {state.mentors.map((m) => (
                <label key={m.id} className="check">
                  <input type="checkbox" checked={exclude.includes(m.id)} onChange={(e) => setExclude(e.target.checked ? [...exclude, m.id] : exclude.filter((x) => x !== m.id))} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </details>
      </div>

      <hr className="rule" />
      <fieldset className="checks">
        <legend className="sr-only">Before you save</legend>
        <label className="check">
          <input type="checkbox" checked={store} onChange={(e) => setStore(e.target.checked)} aria-invalid={(tried && !store) || undefined} />
          <span>Save my profile <span className="muted">(required)</span><span className="hint" style={{ display: "block" }}>Only these details are kept, in this browser. Your resume file isn’t.</span></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={matching} onChange={(e) => setMatching(e.target.checked)} />
          <span>Include me in matching<span className="hint" style={{ display: "block" }}>You’ll still approve any match before an introduction.</span></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} aria-invalid={(tried && !reviewed) || undefined} />
          <span>I’ve checked every detail <span className="muted">(required)</span></span>
        </label>
      </fieldset>

      {tried && errors.length > 0 && (
        <div className="notice notice-error" role="alert" style={{ marginTop: 18 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className="actions" style={{ marginTop: 22 }}>
        <button className="btn" onClick={save}>Save profile</button>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>You can change these details or your choices later from your profile and Privacy.</p>
    </section>
  );
}
