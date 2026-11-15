"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { ListField, SlotPicker, TextField } from "@/components/fields";
import { USC_SCHOOLS, type ExtractedProfile, type ExtractionResponse } from "@/lib/extraction/schema";
import { SAMPLE_RESUME, SAMPLE_RESUME_WITH_INJECTION } from "@/lib/samples";
import { runAllocation } from "@/domain/cohort";
import type { Slot, StudentProfile } from "@/domain/types";

type Step = "consent" | "document" | "review" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "consent", label: "Consent" },
  { key: "document", label: "Resume" },
  { key: "review", label: "Review & details" },
  { key: "done", label: "Saved" },
];
const MAX_BYTES = 2 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 30000;

const EMPTY: ExtractedProfile = { name: "", school: "", program: "", gradYear: null, careerGoals: "", targetRoles: [], industries: [], skills: [], interests: [], communities: [] };

export default function StudentOnboarding() {
  const { state, ready, apply, setRole } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<Step>("consent");
  const [consent, setConsent] = useState({ profileProcessing: false, externalAI: false, matching: true });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extract<ExtractionResponse, { ok: true }> | null>(null);
  const [draft, setDraft] = useState<ExtractedProfile>(EMPTY);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (!ready) return <Loading />;
  const idx = STEPS.findIndex((s) => s.key === step);
  const saved = savedId ? state.students.find((s) => s.id === savedId) : null;

  return (
    <div className="page">
      <header className="page-head">
        
        <h1>Tell us where you’re headed</h1>
        <p className="lede">A few minutes here means your first conversation with a mentor starts in the right place.</p>
      </header>

      <ol className="progress" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={s.key === step ? "step" : undefined} data-done={i < idx}>
            
            {s.label}
            {i < idx && <span className="sr-only"> (complete)</span>}
          </li>
        ))}
      </ol>

      {step === "consent" && (
        <ConsentStep headingRef={headingRef} consent={consent} setConsent={setConsent} onNext={() => setStep("document")} />
      )}
      {step === "document" && (
        <DocumentStep
          headingRef={headingRef}
          externalAIConsent={consent.externalAI}
          onBack={() => setStep("consent")}
          onExtracted={(r) => {
            setExtraction(r);
            setDraft(r.profile);
            setStep("review");
          }}
          onManual={() => {
            setExtraction(null);
            setDraft(EMPTY);
            setStep("review");
          }}
        />
      )}
      {step === "review" && (
        <ReviewStep
          headingRef={headingRef}
          extraction={extraction}
          draft={draft}
          setDraft={setDraft}
          mentors={state.mentors.map((m) => ({ id: m.id, name: m.name }))}
          onBack={() => setStep("document")}
          onSave={(extra) => {
            const at = new Date().toISOString();
            const id = `s-user-${Date.now().toString(36)}`;
            const student: StudentProfile = {
              id,
              kind: "student",
              name: draft.name.trim(),
              school: draft.school,
              program: draft.program.trim(),
              gradYear: draft.gradYear ?? new Date().getFullYear() + 1,
              careerGoals: draft.careerGoals.trim(),
              targetRoles: draft.targetRoles,
              industries: draft.industries,
              skills: draft.skills,
              interests: draft.interests,
              communities: draft.communities,
              availability: extra.availability,
              excludeMentorIds: extra.exclude,
              consent: { ...consent, matching: consent.profileProcessing && consent.matching, version: 1, updatedAt: at },
              fictional: true,
              source: extraction ? extraction.engine : "manual",
              reviewedAt: at,
              createdAt: at,
            };
            const ok = apply(
              (s) => ({ ...s, students: [...s.students, student], auditLog: [...s.auditLog, { at, message: `${student.name} completed onboarding (fields reviewed; source: ${student.source}).` }] }),
              "Profile saved. Your resume file wasn’t kept.",
            );
            if (ok) {
              setSavedId(id);
              setStep("done");
            }
          }}
        />
      )}
      {step === "done" && saved && (
        <section aria-labelledby="done-title" className="stack" style={{ maxWidth: 720 }}>
          <h2 id="done-title" ref={headingRef} tabIndex={-1}>
            {saved.name.split(" ")[0]}’s profile is saved
          </h2>
          <p className="lede">
            We kept only the details you confirmed. {saved.consent.matching ? "They’ll be included the next time the cohort is matched." : "You chose not to be matched, so they won’t be included."}
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                apply((s) => runAllocation(s), "Cohort matched again with the new profile.");
                router.push("/cohort");
              }}
            >
              Match the cohort again
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setRole({ kind: "student", id: saved.id });
                router.push("/matches");
              }}
            >
              View as {saved.name.split(" ")[0]}
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => {
                setSavedId(null);
                setExtraction(null);
                setDraft(EMPTY);
                setConsent({ profileProcessing: false, externalAI: false, matching: true });
                setStep("consent");
              }}
            >
              Onboard another student
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

type HRef = React.RefObject<HTMLHeadingElement | null>;

function ConsentStep({ headingRef, consent, setConsent, onNext }: { headingRef: HRef; consent: { profileProcessing: boolean; externalAI: boolean; matching: boolean }; setConsent: (c: typeof consent) => void; onNext: () => void }) {
  const [tried, setTried] = useState(false);
  const errId = useId();
  return (
    <section aria-labelledby="consent-title" className="split">
      <div>
        <h2 id="consent-title" ref={headingRef} tabIndex={-1} style={{ marginBottom: 12 }}>
          First, what you’re comfortable with
        </h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          You can change these later, and changes take effect right away.
        </p>
        <fieldset className="choices">
          <legend className="sr-only">Consent choices</legend>
          <label className="choice">
            <input type="checkbox" checked={consent.profileProcessing} onChange={(e) => setConsent({ ...consent, profileProcessing: e.target.checked })} aria-describedby={tried && !consent.profileProcessing ? errId : undefined} />
            <span>
              <strong>Save my profile</strong>
              <span className="hint">Required. We keep only the details you confirm, never your resume file.</span>
            </span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={consent.externalAI} onChange={(e) => setConsent({ ...consent, externalAI: e.target.checked })} />
            <span>
              <strong>Let AI read my resume</strong>
              <span className="hint">Optional. Your file is sent to Google’s Gemini to suggest details. Without this, a simple rule-based reader is used.</span>
            </span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={consent.profileProcessing && consent.matching} disabled={!consent.profileProcessing} onChange={(e) => setConsent({ ...consent, matching: e.target.checked })} />
            <span>
              <strong>Include me in matching</strong>
              <span className="hint">Optional. You’ll still approve any match before an introduction.</span>
            </span>
          </label>
        </fieldset>
        {tried && !consent.profileProcessing && (
          <p id={errId} className="notice notice-error" role="alert" style={{ marginTop: 16 }}>
            Saving your profile is needed to continue.
          </p>
        )}
        <div className="row" style={{ marginTop: 24 }}>
          <button
            className="btn"
            onClick={() => {
              setTried(true);
              if (consent.profileProcessing) onNext();
            }}
          >
            Continue
          </button>
          <Link className="btn btn-quiet" href="/privacy">
            How your data is handled
          </Link>
        </div>
      </div>
      <aside className="card-sunk small">
        <p>
          <strong>Where it goes.</strong> In this demo your profile stays in this browser. Your resume is read once on our server and then discarded.
        </p>
        <p style={{ margin: 0 }}>If you allow AI, the file is also sent to Google’s Gemini for that one reading.</p>
      </aside>
    </section>
  );
}

function DocumentStep({ headingRef, externalAIConsent, onBack, onExtracted, onManual }: { headingRef: HRef; externalAIConsent: boolean; onBack: () => void; onExtracted: (r: Extract<ExtractionResponse, { ok: true }>) => void; onManual: () => void }) {
  const [gemini, setGemini] = useState<boolean | null>(null);
  const [engine, setEngine] = useState<"demo" | "ai">("demo");
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; canFallback: boolean } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileId = useId();
  const pasteId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/extract")
      .then((r) => r.json())
      .then((j) => setGemini(Boolean(j.geminiConfigured)))
      .catch(() => setGemini(false));
    return () => abortRef.current?.abort();
  }, []);

  const aiAvailable = gemini === true && externalAIConsent;
  useEffect(() => {
    if (aiAvailable) setEngine("ai");
  }, [aiAvailable]);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) return setError({ message: `That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. Files must be 2 MB or smaller.`, canFallback: false });
    if (!/\.(pdf|txt|md)$/i.test(f.name)) return setError({ message: "Upload a PDF, .txt or .md file.", canFallback: false });
    setFile(f);
    setPaste("");
  };

  const submit = async (useEngine: "demo" | "ai", sample?: string) => {
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.set("engine", useEngine);
      fd.set("externalAIConsent", String(externalAIConsent));
      if (sample) fd.set("text", sample);
      else if (file) fd.set("file", file);
      else if (paste.trim()) fd.set("text", paste);
      else {
        setError({ message: "Choose a file, paste your resume, or use a sample.", canFallback: false });
        return;
      }
      const res = await fetch("/api/extract", { method: "POST", body: fd, signal: ctrl.signal });
      let json: ExtractionResponse;
      try {
        json = await res.json();
      } catch {
        setError({ message: "The server sent an unreadable response. Try again or continue manually.", canFallback: true });
        return;
      }
      if (json.ok) onExtracted(json);
      else setError({ message: json.message, canFallback: json.canFallback });
    } catch (e) {
      setError({ message: (e as Error).name === "AbortError" ? "Reading the document took too long. Try again, use the demo parser, or continue manually." : "Couldn’t reach the server. Check your connection and try again.", canFallback: true });
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="doc-title" className="split">
      <div className="stack" style={{ ["--stack" as string]: "20px" }}>
        <h2 id="doc-title" ref={headingRef} tabIndex={-1}>
          Start from your resume
        </h2>

        <fieldset className="choices">
          <legend>How should we read it?</legend>
          <label className="choice">
            <input type="radio" name="engine" checked={engine === "demo"} onChange={() => setEngine("demo")} />
            <span>
              <strong>Simple reader (not AI)</strong>
              <span className="hint">Looks for labelled lines like “Skills:” and a list of known terms.</span>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="engine" checked={engine === "ai"} disabled={!aiAvailable} onChange={() => setEngine("ai")} />
            <span>
              <strong>AI reader (Gemini)</strong>
              <span className="hint">
                {gemini === null
                  ? "Checking availability…"
                  : !gemini
                    ? "Not available in this demo: no Gemini key is configured."
                    : !externalAIConsent
                      ? "Not available: you chose not to let AI read your resume."
                      : "Reads more formats. Instructions hidden in the file are ignored."}
              </span>
            </span>
          </label>
        </fieldset>

        <div
          className="dropzone"
          data-active={drag}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <label htmlFor={fileId} style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
            Upload a resume
          </label>
          <input id={fileId} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-describedby={`${fileId}-hint`} style={{ margin: "0 auto", maxWidth: 320 }} />
          <p id={`${fileId}-hint`} className="hint" style={{ margin: "8px 0 0" }}>
            PDF, .txt or .md, up to 2 MB. {file && <strong>Selected: {file.name}</strong>}
          </p>
        </div>

        <div className="field">
          <label htmlFor={pasteId}>Or paste the text</label>
          <textarea id={pasteId} value={paste} maxLength={30000} onChange={(e) => { setPaste(e.target.value); if (e.target.value) setFile(null); }} placeholder="Name, school, objective, skills…" style={{ minHeight: 130 }} />
        </div>

        {error && (
          <div className="notice notice-error" role="alert">
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>We couldn’t read that file</p>
              <p>{error.message}</p>
              <div className="row">
                {error.canFallback && engine === "ai" && (
                  <button className="btn btn-small btn-secondary" onClick={() => { setEngine("demo"); submit("demo"); }}>
                    Use the simple reader instead
                  </button>
                )}
                <button className="btn btn-small btn-quiet" onClick={onManual}>
                  Fill it in myself
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="row">
          <button className="btn" onClick={() => submit(engine)} disabled={busy} aria-busy={busy}>
            {busy ? "Reading…" : "Read my resume"}
          </button>
          <button className="btn btn-secondary" onClick={() => submit(engine, SAMPLE_RESUME)} disabled={busy}>
            Use a sample resume
          </button>
          <button className="btn btn-quiet" onClick={onBack} disabled={busy}>
            Back
          </button>
        </div>
        <p role="status" aria-live="polite" className="small muted" style={{ minHeight: "1.4em", margin: 0 }}>
          {busy ? (engine === "ai" ? "Sending to Gemini…" : "Reading your resume…") : ""}
        </p>
      </div>

      <aside className="stack">
        <div className="card-sunk small">
          <p>
            <strong>Nothing is saved yet.</strong> You’ll check every detail on the next step.
          </p>
          <p style={{ margin: 0 }}>Your file is discarded after reading.</p>
        </div>
        <div className="card small stack">
          <h3 style={{ fontSize: "1.05rem" }}>Try a tricky resume</h3>
          <p style={{ margin: 0 }}>
            This sample hides instructions aimed at an AI, like “ignore all previous instructions.” Watch them get flagged and left out.
          </p>
          <button className="btn btn-small btn-secondary" onClick={() => submit(engine, SAMPLE_RESUME_WITH_INJECTION)} disabled={busy}>
            Try the tricky resume
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Download the samples: <a href="/samples/sample-resume-fictional.txt">sample resume</a>,{" "}
            <a href="/samples/sample-resume-injection-test.txt">tricky resume</a>
          </p>
        </div>
      </aside>
    </section>
  );
}

function ReviewStep({
  headingRef,
  extraction,
  draft,
  setDraft,
  mentors,
  onBack,
  onSave,
}: {
  headingRef: HRef;
  extraction: Extract<ExtractionResponse, { ok: true }> | null;
  draft: ExtractedProfile;
  setDraft: (d: ExtractedProfile) => void;
  mentors: { id: string; name: string }[];
  onBack: () => void;
  onSave: (extra: { availability: Slot[]; exclude: string[] }) => void;
}) {
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [tried, setTried] = useState(false);
  const schoolId = useId();
  const yearId = useId();
  const set = <K extends keyof ExtractedProfile>(k: K, v: ExtractedProfile[K]) => setDraft({ ...draft, [k]: v });

  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Add a name.");
  if (!draft.school) errors.push("Choose a USC school.");
  if (!draft.careerGoals.trim()) errors.push("Describe your career goals.");
  if (draft.targetRoles.length + draft.industries.length === 0) errors.push("Add at least one target role or industry.");
  if (availability.length === 0) errors.push("Choose at least one time you’re usually free.");
  if (!reviewed) errors.push("Confirm you’ve checked every detail.");
  const knownSchool = USC_SCHOOLS.some((s) => s.name === draft.school);

  return (
    <section aria-labelledby="review-title">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h2 id="review-title" ref={headingRef} tabIndex={-1}>
          Check your details
        </h2>
        {extraction ? (
          <span className={`tag ${extraction.engine === "gemini" ? "tag-neutral" : "tag-fiction"}`}>
            {extraction.engine === "gemini" ? "Read by AI (Gemini)" : "Read by the simple reader, not AI"}
          </span>
        ) : (
          <span className="tag tag-neutral">Entered by hand</span>
        )}
      </div>

      {extraction && (
        <div className="stack" style={{ marginBottom: 24 }}>
          <p className="notice notice-info" style={{ margin: 0 }}>{extraction.notice}</p>
          {extraction.warnings.map((w) => (
            <p key={w} className="notice notice-warn" role="alert" style={{ margin: 0 }}>
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="split">
        <div className="stack" style={{ ["--stack" as string]: "18px" }}>
          <div className="grid-2">
            <TextField label="Full name" value={draft.name} onChange={(v) => set("name", v)} required invalid={tried && !draft.name.trim()} maxLength={80} />
            <div className="field">
              <label htmlFor={schoolId}>
                USC school <span className="muted">(required)</span>
              </label>
              <select id={schoolId} value={draft.school} onChange={(e) => set("school", e.target.value)} aria-invalid={(tried && !draft.school) || undefined}>
                <option value="">Choose a school…</option>
                {!knownSchool && draft.school && <option value={draft.school}>{draft.school} (as extracted)</option>}
                {USC_SCHOOLS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <TextField label="Program" value={draft.program} onChange={(v) => set("program", v)} hint="e.g. B.S. Computer Science" maxLength={120} />
            <div className="field">
              <label htmlFor={yearId}>Graduation year</label>
              <input id={yearId} type="number" min={2020} max={2034} value={draft.gradYear ?? ""} onChange={(e) => set("gradYear", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>
          <TextField label="Career goals" value={draft.careerGoals} onChange={(v) => set("careerGoals", v)} multiline required invalid={tried && !draft.careerGoals.trim()} hint="In your own words. Used to explain matches and draft milestones." />
          <div className="grid-2">
            <ListField label="Target roles" value={draft.targetRoles} onChange={(v) => set("targetRoles", v)} invalid={tried && draft.targetRoles.length + draft.industries.length === 0} />
            <ListField label="Industries" value={draft.industries} onChange={(v) => set("industries", v)} />
          </div>
          <div className="grid-2">
            <ListField label="Skills" value={draft.skills} onChange={(v) => set("skills", v)} />
            <ListField label="Interests" value={draft.interests} onChange={(v) => set("interests", v)} />
          </div>
          <ListField label="USC communities" value={draft.communities} onChange={(v) => set("communities", v)} hint="Groups you choose to share, e.g. “Transfer student”, “Club sports”. Optional." />
          <SlotPicker legend="When are you usually free?" hint="Used only to find overlapping times with a mentor." value={availability} onChange={setAvailability} invalid={tried && availability.length === 0} />
          <fieldset className="choices">
            <legend>Anyone you’d prefer not to be matched with?</legend>
            <p className="hint" style={{ margin: "4px 0 8px" }}>Optional and private. The allocator will never propose these pairings.</p>
            <div className="row" style={{ gap: "6px 18px" }}>
              {mentors.map((m) => (
                <label key={m.id} className="small row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={exclude.includes(m.id)} onChange={(e) => setExclude(e.target.checked ? [...exclude, m.id] : exclude.filter((x) => x !== m.id))} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="card stack" style={{ position: "sticky", top: 90 }}>
          <h3>Look right?</h3>
          <label className="choice" style={{ borderBottom: "1px solid var(--rule)" }}>
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            <span>
              <strong>I’ve checked every detail</strong>
              <span className="hint">The reader can get things wrong. Matching only uses what you confirm.</span>
            </span>
          </label>
          {tried && errors.length > 0 && (
            <div className="notice notice-error" role="alert">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setTried(true);
                if (errors.length === 0) onSave({ availability, exclude });
              }}
            >
              Save my profile
            </button>
            <button className="btn btn-quiet" onClick={onBack}>
              Back
            </button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Saved in this browser only.</p>
        </aside>
      </div>
    </section>
  );
}
