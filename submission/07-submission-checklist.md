# Submission checklist: AI@USC (deadline Sunday, November 15, 2026, 11:00 AM PT)

Requirements come from https://ai-usc.devpost.com/ and /rules, read November 14, 2026.

## Ready
- [x] **Project name:** `01-project-name.txt`
- [x] **Elevator pitch** (167 characters): `02-elevator-pitch.txt`
- [x] **Project description / story:** `03-devpost-story.md`. Paste it into Devpost's “About the project”.
- [x] **Tags:** `04-tags.txt`
- [x] **Working prototype link:** https://trojan-mentor.vercel.app (Vercel production; publicly reachable; E2E suite passed against it)
- [x] **Public GitHub link:** https://github.com/architguptadev/trojan-mentor
- [x] **Slide deck (PDF):** `deck/trojan-mentor-pitch-deck.pdf` (8 slides). Source: `deck/deck.html`.
- [x] **At least one image:** `screenshots/` (3:2 real captures, see `06-screenshot-plan.md`)
- [x] **Video script:** `05-demo-video-script.md` (120 s)

## Remaining external actions (need you)
- [ ] **Record and upload the demo video** (≤ 3 minutes) following `05-demo-video-script.md`. Upload it to YouTube or Vimeo (unlisted is fine) and paste the link into Devpost. *Not done: it requires your screen recording and voice.*
- [ ] **Create the Devpost submission** at https://ai-usc.devpost.com, and **add every teammate** before the deadline. *Not done: it requires your Devpost account.*
- [ ] **Confirm eligibility:** every teammate is a currently enrolled USC student, registered, and checked in by 9:00 AM Sunday.
- [ ] **Optional: enable Gemini.** In Vercel → Project *trojan-mentor* → Settings → Environment Variables, add `GEMINI_API_KEY` (Production). Redeploy, then upload the sample resume with external-AI consent ticked. Only after that succeeds should you add the “gemini” tag or say “Gemini integrated.” Until then, say “Gemini adapter implemented and mock-tested.”
- [ ] **Optional:** if you upload the deck as Google Slides instead of PDF, import the PDF.
- [ ] **Disclosure:** if Devpost asks about AI tools, mention that the code was written with an AI coding assistant (see `docs/PROVENANCE.md`).

## Claims to keep accurate in the pitch
- Say “intended benefit,” not “impact achieved”: no real students or alumni have used it.
- Email and calendar are **simulated**. Roles are **simulated**, not authentication.
- Compatibility is a **heuristic score**, not a probability.
- There's no USC, PeopleGrove or alumni-database integration, and no affiliation with USC.
