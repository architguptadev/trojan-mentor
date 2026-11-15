# Trojan Mentor

**The Trojan Network, activated.** Trojan Mentor pairs USC students with opt-in alumni mentors. Matching uses career goals, expertise, interests and shared USC communities. The app then helps one introduction become an ongoing relationship with real next steps.

Built for the **AI@USC hackathon (November 14–15, 2026)**. This is an independent student project. It is **not affiliated with, sponsored by, or endorsed by the University of Southern California**, and it connects to no USC system, PeopleGrove, or alumni database. Every person and organization in the demo is fictional.

**Live demo:** https://trojan-mentor.vercel.app · **Submission materials:** [`submission/`](submission/)

> Onboard → review extracted profile → allocate the cohort → student and mentor approve → approve introduction → coordinate first meeting → complete milestones → see updated cohort metrics.

## Quick start (no credentials needed)

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the site and choose **Start the guided demo**. A fictional cohort of 8 students and 5 alumni (1 paused) loads automatically. The guided checklist tracks your actual progress through the journey. **Reset demo data** in the top strip restores the starting cohort at any time.

| Command | What it does |
| --- | --- |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run build && npx playwright install chromium && npm run test:e2e` | End-to-end, accessibility (axe) and mobile tests (Playwright) |
| `npm run typecheck` | TypeScript |

### Optional: Gemini document interpretation

```bash
cp .env.example .env.local
# set GEMINI_API_KEY=...   (server-side only, never NEXT_PUBLIC_)
```

When the key is set **and** a student consents to external AI processing, `/api/extract` sends the uploaded resume (PDF inline, or text) to the Gemini REST API with a fixed JSON response schema. Without the key, the UI says AI is unavailable and offers the deterministic **demo parser — not AI**. A missing key never blocks the demo.

## What's built, partial, and planned

| Status | Item |
| --- | --- |
| ✅ Built | Student onboarding: three separate consents, upload (PDF/TXT/MD ≤ 2 MB) or paste, extraction into editable fields, required review before save |
| ✅ Built | Deterministic demo parser, clearly labelled “not AI” |
| ✅ Built | File validation: size, type, fake/corrupt PDFs, invalid UTF-8, binary text, scanned PDFs with no text, empty input |
| ✅ Built | Untrusted-document handling: instruction-like text is detected, flagged, and dropped; control and bidi characters are stripped; lengths are bounded; React escapes all output |
| ✅ Built | Alumni onboarding: trajectory, expertise, preferences, availability, capacity, explicit opt-in, visible/paused |
| ✅ Built | Explainable heuristic compatibility (0–100 points) with per-signal reasons grounded in reviewed fields |
| ✅ Built | Global cohort allocation by min-cost flow (capacity, consent, opt-in, visibility, exclusions, one mentor per student, threshold 35, unmatched outcomes with reasons, greedy comparison) |
| ✅ Built | Bilateral approval under simulated roles; decline closes the pair permanently |
| ✅ Built | Stateful coordination: exact drafts, required approver, draft fingerprint, attempts, timestamped plan/approve/act/observe history, stable idempotency keys, failure injection, and retry without duplicates |
| ✅ Built | Consent withdrawal revokes matches and cancels pending actions; consent versioning makes stale approvals unusable |
| ✅ Built | Coordinator what-ifs: each mentor's extra seat is scored by re-running the optimizer (exact gain and who would be newly matched), plus career directions no opted-in alum covers |
| ✅ Built | Role-aware “waiting on you” inbox: match decisions, drafts to approve, failed sends to retry, meetings to confirm, open milestones |
| ✅ Built | Exports: cohort allocation CSV (with spreadsheet formula-injection escaping) and a per-person data download (JSON) |
| ✅ Built | Template-based first-meeting prep and milestones from reviewed goals (labelled “not AI”) |
| ✅ Built | Cohort dashboard computed from live state; delete a profile; reset demo |
| 🟡 Implemented, not live-verified | Gemini adapter (`src/lib/extraction/gemini.ts`). It's covered by mocked tests (timeouts, 429, 401/403, non-JSON, off-schema, blocked, injection in output). **It hasn't been run against the live Gemini API**, because no key was available during the build. |
| 🟡 Partial | Postgres/Supabase schema (`supabase/migrations/`). It applies cleanly to vanilla Postgres 17, with RLS enabled and no policies yet. The app doesn't use it: demo state lives in browser localStorage. |
| 🟡 Simulated | Email and calendar adapters. Nothing is sent and no calendar is connected. The UI says “Recorded (simulated)”, never “sent”. |
| ⏳ Planned | Real authentication (e.g. USC SSO via the university, if it's ever approved), server persistence, RLS policies, real email/calendar with OAuth, AI-assisted milestone suggestions, outcome measurement with consenting participants |

## Architecture

```
src/
  domain/            Pure TypeScript, framework-free, fully unit-tested
    types.ts         AppState, profiles, consent, matches, actions, outbox
    ontology.ts      Hand-written synonym map used by scoring and the demo parser
    compatibility.ts Heuristic score + grounded reasons
    allocator.ts     Min-cost flow (Bellman–Ford successive shortest paths), greedy and brute-force baselines
    cohort.ts        Eligibility, exclusions, threshold, re-runs that keep approved matches, unmatched explanations
    workflow.ts      Consent, bilateral approval, plan/approve/execute with idempotent simulated adapters
    milestones.ts    Template-based prep and milestones
    metrics.ts       Dashboard figures computed from state
    insights.ts      Exact what-if re-runs: value of one more seat, uncovered directions
    inbox.ts         What is waiting on the current (simulated) person
    seed.ts          Fictional cohort
  lib/
    store.tsx        React context; persists AppState to localStorage; simulated roles
    extraction/      Server-side document reading, demo parser, Gemini adapter, sanitizer, schemas
  app/               Next.js App Router pages and /api/extract
supabase/migrations  Postgres schema for the server-backed phase
tests/               Vitest
e2e/                 Playwright
```

**Why this shape.** The simplest architecture that gives a reliable demo is to keep all rules in a pure domain layer and use the browser as the store. The only server code is document extraction, which has to run server-side to keep model keys secret. The domain functions are the same ones a server API would call, so moving to Postgres means swapping the store, not rewriting rules.

### The four layers, labelled honestly

1. **AI interpretation.** Gemini turns a document into suggested fields, only with consent and credentials. Otherwise the demo parser runs, labelled “not AI”.
2. **Compatibility scoring.** A transparent heuristic, explained below. It isn't a probability, prediction or model confidence.
3. **Deterministic allocation.** Min-cost flow over eligible pairs.
4. **Approved coordination.** Plan → approve → act → observe, with simulated adapters.

### Matching

Score (integer, max 100) is a sum of:

| Signal | Points |
| --- | --- |
| Career direction (target roles, industries and goal text vs. mentor roles and industries) | 20 per shared concept, max 40 |
| Relevant expertise (skills and interests vs. mentor expertise) | 9 each, max 25 |
| Same USC school | 10 |
| Shared communities | 8 each, max 15 |
| Availability overlap | 6 for one slot, 10 for two or more |

Terms are normalized through `ontology.ts`. Pairs below **35** aren't eligible. The allocator builds `source → student (cap 1) → mentor (cost −score) → sink (cap = capacity)`. It augments along cheapest residual paths and stops when no path has negative cost, which gives the maximum-total-score assignment. Correctness is tested against brute-force enumeration on 300 random cohorts. A constructed case shows greedy losing (90 vs 145). On the seed cohort, greedy totals 425 and matches 5 students; the optimizer totals 461 and matches 6.

### Coordination safety

- Approving a match ≠ approving a message. Each action records a `requiredApprover` (coordinator for introductions; the student for calendar invites and follow-ups).
- Approval stores the draft's FNV-1a fingerprint and both parties' consent versions. Editing the draft or changing consent invalidates it.
- `executeAction` writes to a ledger keyed by `idempotencyKey`. A lost acknowledgement followed by a retry finds the existing entry and records it with no duplicate.
- No timers, background jobs or autonomous sends. Every execution is a user click after approval.

## Data and privacy

- Demo state lives in **localStorage in one browser**. It isn't shared across devices.
- Uploaded resumes exist only in memory for one `/api/extract` request. They are never written to disk, a database or logs. Only reviewed fields are kept.
- If external AI is consented to and configured, the document is sent to Google's Gemini API.
- Profile deletion removes the person and all derived matches, drafts and simulated deliveries.

## Deployment

The app is a standard Next.js app with no required environment variables.

```bash
npx vercel deploy --prod      # or any Node 20+ host: npm run build && npm start
```

To enable Gemini on Vercel, add `GEMINI_API_KEY` as a server environment variable.

## Known limitations

- Simulated roles aren't authentication. Anyone using the browser can act as anyone.
- Scoring weights were chosen by hand. They haven't been learned from or validated against mentorship outcomes.
- The ontology is small. Unrecognized terms only match exactly.
- The demo parser expects labelled lines and can't read scanned images.
- Meeting times use fixed slot times in Pacific time. There's no time-zone handling for mentors elsewhere.
- Scale: the allocator is O(S · E · V) Bellman–Ford, fine for hundreds of people. Thousands would need a faster solver.
- Impact on students is an **intended** benefit and hasn't been measured.

## Provenance

See [`docs/PROVENANCE.md`](docs/PROVENANCE.md). All code, copy, design and the fictional dataset were created during the hackathon on November 14–15, 2026, using public open-source libraries.

## License

MIT
