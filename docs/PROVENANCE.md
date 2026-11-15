# Provenance and dependency attribution

## Event rules checked

The official AI@USC pages were read on **November 14, 2026**: https://ai-usc.devpost.com/ and https://ai-usc.devpost.com/rules. These are the AI@USC rules, not general HackSC rules. The relevant points:

- **Dates:** in person, Saturday November 14 to Sunday November 15, 2026. Submissions are due **Sunday November 15 at 11:00 AM PT**.
- **Originality:** all code, design assets and functional prototypes must be created during the hackathon period (November 14–15). Open-source libraries, frameworks and pre-existing public APIs are permitted.
- **Submission:** project description, working prototype link, public GitHub link, video demo of **up to 3 minutes**, slide deck (PDF or Google Slides), and at least one image.
- **Judging:** Impact & Campus Relevance 30%, Technical & AI Execution 25%, Feasibility & Implementation 25%, User Experience & Design 20%.
- **Eligibility:** currently enrolled USC students, in person, teams of 1–4. The submitting team is responsible for meeting this.

## What was created during the hackathon

Everything in this repository was created on **November 14–15, 2026**: application code, tests, styles, the logo mark, copy, the fictional cohort, sample resumes, the database schema, docs and submission materials. The Git history starts during the event.

- No pre-hackathon application code was reused. An earlier, unverified TypeScript scaffold from another environment was **not** available in this workspace and was not used.
- The project was built with an AI coding assistant (Claude Code). The published rules don't prohibit AI tools. The team should disclose this on Devpost if the organizers ask.
- **Fictional data:** every student, alumnus, employer and lab in `src/domain/seed.ts` and `src/lib/samples.ts` was invented. No alumni data was scraped, imported or inferred. Organization names carry a “(fictional)” label.
- **Branding:** the name “Trojan Mentor”, the two-arc mark and the palette (#8a1c2b cardinal, #a87b22 gold) are original. No USC logos, seals, wordmarks or official marks are used. The footer states that the project isn't affiliated with USC. USC school names appear only as profile field values.

## Runtime dependencies (open source)

| Package | License | Use |
| --- | --- | --- |
| next 16 | MIT | App framework, API route |
| react / react-dom 19 | MIT | UI |
| zod 4 | MIT | Validating model and extractor output |
| unpdf 2 | MIT | Server-side PDF text extraction (bundles Mozilla pdf.js, Apache-2.0) |

## Development dependencies

| Package | License | Use |
| --- | --- | --- |
| typescript | Apache-2.0 | Types |
| vitest | MIT | Unit and integration tests |
| @playwright/test | Apache-2.0 | End-to-end tests and screenshots |
| @axe-core/playwright | MPL-2.0 | Automated accessibility checks |
| @types/* | MIT | Type definitions |

## Fonts and services

- **Fraunces** (SIL Open Font License 1.1) and **Public Sans** (SIL OFL 1.1), self-hosted at build time via `next/font/google`.
- **Google Gemini API** (optional, public API). Called server-side only when `GEMINI_API_KEY` is set and the student consents. It was not live-tested during the build.
- **Postgres 17** (`postgres:17-alpine` Docker image) was used only to check that the migration applies.
