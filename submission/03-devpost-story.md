## Inspiration

USC has one of the most loyal alumni networks in the country. Yet for many students, especially first-generation and transfer students, that network is a rumour rather than a resource. Three things get in the way: a reason to reach out, the right person to reach, and a plan for what happens after "hello." Existing directories put the burden on the student to search, cold-message and follow up alone.

We wanted to turn the network from something you search into something that shows up: a small, consented cohort where the right alumni say yes to the right students, and every match comes with a first conversation and next steps.

*Impact is an intended benefit. We haven't measured outcomes with real students or alumni yet.*

## What it does

Trojan Mentor runs the whole mentorship journey:

1. **Student onboarding.** Three separate consents: profile storage, external AI processing, and visibility for matching. Then upload a resume (PDF/TXT/MD) or paste it. Extracted fields arrive as an editable draft, and nothing is saved until the student confirms every field.
2. **Alumni onboarding.** Career trajectory, expertise, mentoring preferences, availability, capacity, explicit opt-in, and a visible/paused switch.
3. **Explainable compatibility.** Each pair gets a 0–100 *heuristic* score built from career direction, relevant expertise, shared school, shared communities and overlapping availability. Every point comes with a sentence grounded in the reviewed fields. We say plainly that it's not a probability.
4. **Global cohort allocation.** A min-cost-flow optimizer maximizes total compatibility across the whole cohort, within each mentor's capacity, consent, opt-in, visibility and exclusions. It never proposes a pair below a threshold. Students who don't get a mentor are shown with an honest reason. On the demo cohort, greedy "best pair first" matching totals 425 and matches 5 students. The optimizer totals 461 and matches 6.
5. **Bilateral approval.** The student and the mentor each approve, under clearly labelled *simulated* roles.
6. **Approved coordination.** The introduction, the calendar invitation and the follow-up each follow plan → approve → act → observe. Each one stores the exact draft, its required approver, attempt counts, timestamped history and a stable idempotency key. You can force a provider failure or a lost acknowledgement and watch the retry finish without sending twice.
7. **Development milestones.** First-meeting prep and four milestones are filled from the student's own goals and the mentor's background. They're labelled as templates, not AI.
8. **Coordinator insights.** The optimizer is re-run with one extra seat per mentor, showing exactly how much the cohort total rises and who would newly be matched. It also names the career directions no opted-in alum covers, so recruiting asks are specific. A role-aware *waiting on you* inbox and CSV/JSON exports make it workable for a real program office.
9. **Cohort dashboard.** Coverage, mentor capacity, approvals, introductions, meetings and milestones, all computed live from current state and labelled as fictional demo activity.

## How we built it

- **Next.js 16 + TypeScript + React 19**, deployed on **Vercel**.
- A **pure domain layer** (`src/domain`) holds every rule: scoring, the allocator, consent, approvals, coordination and metrics. The UI only calls these functions, so the same rules can move behind a server API unchanged.
- **Allocator:** successive-shortest-path min-cost flow with Bellman–Ford. It's verified against brute-force enumeration on 300 random cohorts, plus a constructed case where greedy loses (90 vs 145).
- **Document pipeline:** server-side `/api/extract` with size, type, magic-byte and encoding validation, and PDF text extraction (unpdf). It has a Gemini REST adapter with a fixed JSON response schema, a timeout, and classified errors (quota, auth, invalid output). A deterministic **demo parser — explicitly "not AI"** — runs when no key is configured. A sanitizer detects and drops instruction-like content ("ignore previous instructions…"), strips control and bidi characters, and bounds every field.
- **Consent versioning:** every approval records the consent version it was made under. Withdrawing consent revokes matches and cancels pending drafts, so a stale approval can't authorize anything new.
- **Persistence:** browser localStorage for the credential-free demo, disclosed throughout the UI. A Postgres/Supabase schema with row-level security enabled ships in the repo for the server-backed phase.
- **Design:** an original editorial identity: Fraunces and Public Sans, warm ivory, deep cardinal and restrained gold. It uses ledgers and rules instead of metric tiles. It isn't USC branding.

## Challenges we ran into

- **Being honest about "AI."** It's tempting to call everything AI. We split the product into four labelled layers: AI interpretation, heuristic scoring, deterministic allocation and approved coordination. We built a fallback parser and labelled it "not AI" everywhere it appears.
- **Making greedy matching visibly worse.** Independent "top match" lists feel fine until two students want the same mentor. We designed the fictional cohort so the difference is real and visible on the cohort page.
- **Retries without duplicates.** A lost acknowledgement is the hard case: the message went out, but you don't know it. A ledger keyed by idempotency key lets a retry observe the earlier delivery instead of repeating it.
- **Consent that actually revokes.** Withdrawal had to invalidate approvals already granted, not just block future ones.

## Accomplishments that we're proud of

- The whole journey works end to end in a browser with no credentials, and it survives a refresh.
- 66 unit/integration tests and 7 Playwright end-to-end tests pass. The end-to-end tests cover the full journey, consent withdrawal, declines, document errors, an axe accessibility scan, keyboard access and mobile overflow. The suite also passes against the live deployment.
- Unmatched students get a truthful explanation instead of a manufactured match.

## What we learned

Trust is a product feature. Labelling what's simulated, what's heuristic and what's AI made the product easier to explain, and it changed the design: every outgoing action needs explicit approval of its exact content.

## What's next for Trojan Mentor

- A pilot with one school's career center or a student organization, run with Student Government. The coordinator workflow already exists.
- Real authentication and server persistence (the Postgres schema is ready), plus row-level security policies.
- Live Gemini extraction with consenting students, and AI-assisted milestone suggestions that stay clearly labelled.
- Real email and calendar delivery via OAuth, replacing the simulated adapters.
- Measuring outcomes (first meetings held, milestones completed, retention) with participant consent before claiming impact.

*Independent student project built at AI@USC, November 14–15, 2026. Not affiliated with or endorsed by USC. All people in the demo are fictional. No USC, PeopleGrove or alumni-database integration.*
