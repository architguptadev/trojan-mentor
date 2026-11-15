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
        <p className="eyebrow">Student onboarding</p>
        <h1>Tell us where you’re headed</h1>
        <p className="lede">A few minutes now means a mentor conversation that starts in the right place.</p>
      </header>

      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={s.key === step ? "step" : undefined} data-done={i < idx}>
            <span className="n">{i + 1}</span>
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
              "Profile saved. The raw document was not stored.",
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
            Only the reviewed fields were kept, in this browser. {saved.consent.matching ? "They’ll be included the next time the cohort is allocated." : "Matching consent is off, so they won’t be included in allocation."}
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                apply((s) => runAllocation(s), "Cohort re-allocated with the new profile.");
                router.push("/cohort");
              }}
            >
              Re-allocate the cohort
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
          Three separate choices
        </h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          You can change any of these later from Privacy & data. Withdrawing takes effect immediately.
        </p>
        <fieldset>
          <legend className="sr-only">Consent choices</legend>
          <label className="check">
            <input type="checkbox" checked={consent.profileProcessing} onChange={(e) => setConsent({ ...consent, profileProcessing: e.target.checked })} aria-describedby={tried && !consent.profileProcessing ? errId : undefined} />
            <span>
              <strong>Store and process my reviewed profile</strong>
              <span className="hint">Required to take part. Only the fields you review are kept — never the raw resume. In this demo they’re stored in this browser only.</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={consent.externalAI} onChange={(e) => setConsent({ ...consent, externalAI: e.target.checked })} />
            <span>
              <strong>Allow external AI processing of my document</strong>
              <span className="hint">Optional. If the server has Gemini configured, your document is sent to Google’s Gemini API to suggest fields. Without this, a rule-based demo parser runs instead.</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={consent.profileProcessing && consent.matching} disabled={!consent.profileProcessing} onChange={(e) => setConsent({ ...consent, matching: e.target.checked })} />
            <span>
              <strong>Make me visible for matching</strong>
              <span className="hint">Optional. Lets the allocator propose you to opted-in alumni. You still approve any match yourself.</span>
            </span>
          </label>
        </fieldset>
        {tried && !consent.profileProcessing && (
          <p id={errId} className="notice notice-error" role="alert" style={{ marginTop: 16 }}>
            Profile storage and processing is needed to continue. You can still read how the program works without it.
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
            How data is handled
          </Link>
        </div>
      </div>
      <aside className="panel-quiet small">
        <p>
          <strong>What’s stored where.</strong> The demo keeps everything in your browser’s localStorage. Uploaded files go
          to this app’s server only for the length of one request to read them, and are never written to disk or a database.
        </p>
        <p style={{ margin: 0 }}>If external AI is on and configured, that request also goes to Google’s Gemini API under Google’s terms.</p>
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

        <fieldset>
          <legend>How should we read it?</legend>
          <label className="check">
            <input type="radio" name="engine" checked={engine === "demo"} onChange={() => setEngine("demo")} />
            <span>
              <strong>Demo parser — not AI</strong>
              <span className="hint">Fixed rules and keyword lists. Works offline from any AI service. Best with labelled lines like “Skills: …”.</span>
            </span>
          </label>
          <label className="check">
            <input type="radio" name="engine" checked={engine === "ai"} disabled={!aiAvailable} onChange={() => setEngine("ai")} />
            <span>
              <strong>AI interpretation (Gemini)</strong>
              <span className="hint">
                {gemini === null
                  ? "Checking whether this server has AI configured…"
                  : !gemini
                    ? "Not available: this deployment has no Gemini credentials configured."
                    : !externalAIConsent
                      ? "Not available: you didn’t consent to external AI processing. Go back to change that."
                      : "Sends the document to Google’s Gemini API. Treated as untrusted data; output is validated."}
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
              <p style={{ fontWeight: 600, marginBottom: 4 }}>We couldn’t read that document</p>
              <p>{error.message}</p>
              <div className="row">
                {error.canFallback && engine === "ai" && (
                  <button className="btn btn-small btn-secondary" onClick={() => { setEngine("demo"); submit("demo"); }}>
                    Use the demo parser instead
                  </button>
                )}
                <button className="btn btn-small btn-quiet" onClick={onManual}>
                  Fill in fields manually
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="row">
          <button className="btn" onClick={() => submit(engine)} disabled={busy} aria-busy={busy}>
            {busy ? "Reading document…" : "Extract fields for review"}
          </button>
          <button className="btn btn-secondary" onClick={() => submit(engine, SAMPLE_RESUME)} disabled={busy}>
            Use the fictional sample resume
          </button>
          <button className="btn btn-quiet" onClick={onBack} disabled={busy}>
            Back
          </button>
        </div>
        <p role="status" aria-live="polite" className="small muted" style={{ minHeight: "1.4em", margin: 0 }}>
          {busy ? (engine === "ai" ? "Sending to Gemini and validating the response…" : "Running the demo parser…") : ""}
        </p>
      </div>

      <aside className="stack">
        <div className="panel-quiet small">
          <p>
            <strong>Nothing is final yet.</strong> Whatever we extract becomes an editable draft. You review every field before
            anything is saved or used for matching.
          </p>
          <p style={{ margin: 0 }}>The document itself is discarded after reading.</p>
        </div>
        <div className="panel small stack">
          <h3 style={{ fontSize: "1rem" }}>Testing safety</h3>
          <p style={{ margin: 0 }}>
            Try the sample that hides instructions aimed at an AI (“ignore all previous instructions…”). It’s treated as data,
            flagged, and dropped.
          </p>
          <button className="btn btn-small btn-secondary" onClick={() => submit(engine, SAMPLE_RESUME_WITH_INJECTION)} disabled={busy}>
            Try the prompt-injection sample
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Downloadable copies: <a href="/samples/sample-resume-fictional.txt">sample resume</a> ·{" "}
            <a href="/samples/sample-resume-injection-test.txt">injection test</a>
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
  if (!reviewed) errors.push("Confirm you’ve reviewed every field.");
  const knownSchool = USC_SCHOOLS.some((s) => s.name === draft.school);

  return (
    <section aria-labelledby="review-title">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h2 id="review-title" ref={headingRef} tabIndex={-1}>
          Review before anything is saved
        </h2>
        {extraction ? (
          <span className={`tag ${extraction.engine === "gemini" ? "tag-neutral" : "tag-fiction"}`}>
            {extraction.engine === "gemini" ? "AI interpretation · Gemini" : "Demo parser — not AI"}
          </span>
        ) : (
          <span className="tag tag-neutral">Manual entry</span>
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
          <fieldset>
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

        <aside className="panel stack" style={{ position: "sticky", top: 90 }}>
          <h3>Ready to save?</h3>
          <label className="check" style={{ borderBottom: "1px solid var(--rule)" }}>
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            <span>
              <strong>I’ve reviewed every field</strong>
              <span className="hint">Extracted values can be wrong. Matching uses only what you confirm here.</span>
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
              Save reviewed profile
            </button>
            <button className="btn btn-quiet" onClick={onBack}>
              Back
            </button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Saved to this browser only. Demo profiles are treated as fictional.</p>
        </aside>
      </div>
    </section>
  );
}
