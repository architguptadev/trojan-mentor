# Screenshots

All desktop images are **real captures** from the running app, taken by the Playwright E2E suite (`e2e/journey.spec.ts`) at **1500×1000 (3:2)**. Each is well under 5 MB. Mobile captures come from a Pixel 7 emulation and are supporting material, not 3:2.

| # | File | Shows | Suggested Devpost caption |
| --- | --- | --- | --- |
| 1 | `screenshots/01-landing.png` | Promise and entry point | Your next chapter starts with a conversation. |
| 2 | `screenshots/02-guided-demo.png` | Progress-tracking guided demo | A guided checklist that tracks real progress through the journey. |
| 3 | `screenshots/03-review-extracted-profile.png` | Extracted fields under review, labelled “Demo parser — not AI” | Nothing is saved until the student reviews every extracted field. |
| 4 | `screenshots/04-cohort-allocation.png` | Optimizer vs greedy (461/6 vs 425/5), explained pairings | The whole cohort is optimized at once, and every point is explained. |
| 5 | `screenshots/05-coordination-retry.png` | Plan → approve → act → observe with exact draft and attempts | Every outgoing message is approved word for word, and retries never send twice. |
| 6 | `screenshots/06-match-milestones.png` | Retry history, first-meeting prep, milestones | Milestones drawn from the student’s own goals. |
| 7 | `screenshots/07-dashboard.png` | Cohort ledger computed from live state | Cohort health, computed from live state (fictional demo data). |
| 8 | `screenshots/08-injection-flagged.png` | Prompt-injection sample flagged and dropped | Instructions hidden in a document are treated as data. |
| 9 | `screenshots/09-cohort-insights.png` | Exact what-ifs: one more seat, uncovered directions | Know exactly which alum to ask, and why. |
| 10 | `screenshots/10-inbox.png` | Role-aware “waiting on you” inbox | Everyone sees exactly what is waiting on them. |
| – | `screenshots/04b-cohort-after-onboarding.png` | Cohort after adding the new student | (optional) |
| – | `screenshots/mobile-*.png` | Mobile landing, menu, cohort, match | (optional) |

**Recommended Devpost gallery order:** 1, 4, 9, 5, 3, 10, 7, 6, 8. Use 1 as the thumbnail.

To regenerate: `npm run build && npm run test:e2e`.
