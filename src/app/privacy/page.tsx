"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { roleLabel, useApp } from "@/lib/store";
import { Loading } from "@/components/bits";
import { deletePerson, setMentorVisibility, updateConsent } from "@/domain/workflow";
import { download, personExport } from "@/lib/export";

export default function PrivacyPage() {
  const { state, ready, role, apply, reset, setRole } = useApp();
  const pickId = useId();
  const [picked, setPicked] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!ready) return <Loading />;

  const personId = role.kind === "coordinator" ? picked : role.id;
  const person = state.students.find((s) => s.id === personId) ?? state.mentors.find((m) => m.id === personId);

  return (
    <div className="page">
      <header className="page-head">
        
        <h1>Your data, and how to take it back</h1>
        <p className="lede">What we keep, where it lives, and the switches to change your mind.</p>
      </header>

      <section aria-labelledby="where-title" style={{ marginBottom: 48 }}>
        <h2 id="where-title" style={{ marginBottom: 14 }}>Where things live in this demo</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Data</th><th scope="col">Where</th><th scope="col">How long</th></tr></thead>
            <tbody>
              <tr><td>Reviewed profiles, consents, matches, drafts, history</td><td>This browser’s localStorage only. Not shared across devices or browsers, and not sent to any server.</td><td>Until you delete it or reset the demo (or clear site data).</td></tr>
              <tr><td>Uploaded or pasted resume</td><td>Sent to this app’s server for one request so fields can be extracted, then discarded. Never written to disk, a database or logs.</td><td>The length of one request.</td></tr>
              <tr><td>Resume sent for AI interpretation</td><td>Only if you consented to external AI <em>and</em> the deployment has Gemini configured: forwarded to Google’s Gemini API under Google’s terms.</td><td>Governed by Google’s API data policies.</td></tr>
              <tr><td>“Sent” emails and calendar invitations</td><td>Simulated. Recorded as entries in local storage. No real email or calendar service is connected.</td><td>Same as profiles.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          A production deployment would move this state to a server database (a Postgres schema is included in the repository) behind real authentication.
          That is not running in this demo.
        </p>
      </section>

      <section aria-labelledby="consent-title" className="split" style={{ marginBottom: 48 }}>
        <div>
          <h2 id="consent-title" style={{ marginBottom: 6 }}>Your choices</h2>
          <p className="small muted" style={{ marginBottom: 16 }}>
            {role.kind === "coordinator" ? "As coordinator you can view consent for anyone in the demo. In a real system only the person themselves could change it." : `Showing consent for ${roleLabel(state, role)}.`}
          </p>
          {role.kind === "coordinator" && (
            <div className="field" style={{ marginBottom: 16, maxWidth: 420 }}>
              <label htmlFor={pickId}>Person</label>
              <select id={pickId} value={picked} onChange={(e) => { setPicked(e.target.value); setConfirmDelete(false); }}>
                <option value="">Choose someone…</option>
                <optgroup label="Students">{state.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                <optgroup label="Alumni mentors">{state.mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              </select>
            </div>
          )}
          {!person ? (
            <p className="empty small">Choose a person, or switch “Viewing as” to a student or mentor.</p>
          ) : (
            <div>
              <fieldset className="choices">
                <legend className="sr-only">Consent for {person.name}</legend>
                <label className="choice">
                  <input type="checkbox" checked={person.consent.profileProcessing} onChange={(e) => apply((s) => updateConsent(s, person.id, { profileProcessing: e.target.checked }), e.target.checked ? "Profile processing consent granted." : "Consent withdrawn. Open matches were revoked and pending messages cancelled.")} />
                  <span><strong>Save my profile</strong><span className="hint">Turning this off also ends your matches and cancels anything waiting to be sent.</span></span>
                </label>
                <label className="choice">
                  <input type="checkbox" checked={person.consent.externalAI} onChange={(e) => apply((s) => updateConsent(s, person.id, { externalAI: e.target.checked }), "External AI consent updated.")} />
                  <span><strong>Let AI read my resume</strong><span className="hint">Only affects future uploads.</span></span>
                </label>
                <label className="choice">
                  <input type="checkbox" checked={person.consent.matching} disabled={!person.consent.profileProcessing} onChange={(e) => apply((s) => updateConsent(s, person.id, { matching: e.target.checked }), e.target.checked ? "Visible for matching again. Earlier approvals stay invalid — a new allocation and new approvals are required." : "Removed from matching. Open matches were revoked and pending messages cancelled.")} />
                  <span><strong>Include me in matching</strong><span className="hint">Turning this off ends your matches. Turning it back on doesn’t revive old approvals.</span></span>
                </label>
                {person.kind === "mentor" && (
                  <label className="choice">
                    <input type="checkbox" checked={person.visibility === "visible"} onChange={(e) => apply((s) => setMentorVisibility(s, person.id, e.target.checked ? "visible" : "paused"), e.target.checked ? "Visibility resumed." : "Visibility paused.")} />
                    <span><strong>Open to new matches</strong><span className="hint">Pause new suggestions without leaving the program.</span></span>
                  </label>
                )}
              </fieldset>
              <p className="tiny muted" style={{ marginTop: 8 }}>Any change here means earlier approvals have to be given again.</p>
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn btn-small btn-secondary" onClick={() => { const e = personExport(state, person.id); if (e) download(`trojan-mentor-${person.id}.json`, JSON.stringify(e, null, 2), "application/json"); }}>
                  Download this profile’s data
                </button>
                {confirmDelete ? (
                  <>
                    <span className="small">Delete {person.name} and every match, draft and record derived from them? This can’t be undone.</span>
                    <button className="btn btn-small btn-danger" onClick={() => { if (apply((s) => deletePerson(s, person.id), "Profile and derived data deleted.")) { setConfirmDelete(false); setPicked(""); if (role.kind !== "coordinator") setRole({ kind: "coordinator" }); } }}>Delete permanently</button>
                    <button className="btn btn-small btn-quiet" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-small btn-danger" onClick={() => setConfirmDelete(true)}>Delete this profile</button>
                )}
              </div>
            </div>
          )}
        </div>
        <aside className="card stack">
          <h3>Start the demo over</h3>
          <p className="small" style={{ margin: 0 }}>Replaces everything in this browser with the original fictional cohort.</p>
          {confirmReset ? (
            <div className="row">
              <button className="btn btn-small btn-danger" onClick={() => { reset(); setConfirmReset(false); }}>Yes, reset all demo data</button>
              <button className="btn btn-small btn-quiet" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-small btn-secondary" onClick={() => setConfirmReset(true)}>Reset demo data</button>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>See also <Link href="/how-it-works">how matching works</Link>.</p>
        </aside>
      </section>
    </div>
  );
}
