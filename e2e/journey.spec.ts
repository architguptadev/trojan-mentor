import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SHOTS = "submission/screenshots";
const shot = async (page: Page, name: string) => {
  await page.addStyleTag({ content: ".toast{display:none!important}" });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const alerts = (page: Page) => page.locator("[role=alert]:not(#__next-route-announcer__)");
const asRole = (page: Page, value: string) => page.getByLabel("Viewing as").selectOption(value);
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("trojan-mentor:state") || "null"));

test.describe.configure({ mode: "serial" });

test("complete journey: onboard → allocate → bilateral approval → intro with failure+retry → meeting → milestones → dashboard, persisting across refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your next chapter starts with a conversation.");
  await shot(page, "01-landing");
  await page.getByRole("link", { name: "Start the guided demo" }).click();
  await expect(page.getByRole("heading", { name: /Walk the whole journey/ })).toBeVisible();
  await shot(page, "02-guided-demo");

  // 1. Student onboarding with the deterministic demo parser
  await page.getByRole("button", { name: "Open student onboarding" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(alerts(page)).toContainText("needed to continue");
  await page.getByRole("checkbox", { name: /Store and process my reviewed profile/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use the fictional sample resume" }).click();
  await expect(page.getByRole("heading", { name: "Review before anything is saved" })).toBeVisible();
  await expect(page.getByText("Demo parser — not AI").first()).toBeVisible();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Imani Castellanos-Reed");
  // Saving is blocked until availability + review confirmation
  await page.getByRole("button", { name: "Save reviewed profile" }).click();
  await expect(alerts(page).filter({ hasText: "Confirm you’ve reviewed" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Tue evening" }).check();
  await page.getByRole("checkbox", { name: "Thu evening" }).check();
  await shot(page, "03-review-extracted-profile");
  await page.getByRole("checkbox", { name: /I’ve reviewed every field/ }).check();
  await page.getByRole("button", { name: "Save reviewed profile" }).click();
  await expect(page.getByRole("heading", { name: /profile is saved/ })).toBeVisible();

  // 2. Allocate
  await page.getByRole("button", { name: "Re-allocate the cohort" }).click();
  await expect(page).toHaveURL(/\/cohort/);
  await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not matched this round" })).toBeVisible();
  await expect(page.locator("table").first()).toContainText("Riley Brannigan-Cho");
  await expect(page.getByText(/threshold/).first()).toBeVisible();
  await shot(page, "04b-cohort-after-onboarding");
  let st = await state(page);
  expect(st.allocationRuns).toHaveLength(1);
  expect(st.allocationRuns[0].totalScore).toBeGreaterThanOrEqual(st.allocationRuns[0].greedyTotal);

  // 3. Bilateral approval on Maya & Daniel
  const maya = st.matches.find((m: { studentId: string; mentorId: string }) => m.studentId === "s-maya");
  expect(maya.mentorId).toBe("m-daniel");
  await page.goto(`/matches/${maya.id}`);
  await expect(page.getByRole("heading", { name: "Both sides decide" })).toBeVisible();
  // Coordinator cannot approve on behalf of a party
  await expect(page.getByRole("button", { name: "Approve match" })).toHaveCount(0);
  await asRole(page, "student:s-maya");
  await page.getByRole("button", { name: "Approve match" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  st = await state(page);
  expect(st.actions).toHaveLength(0); // one approval is not enough
  await asRole(page, "mentor:m-daniel");
  await page.getByRole("button", { name: "Approve match" }).click();
  await expect(page.getByText("Both approved", { exact: true }).first()).toBeVisible();

  // 4. Introduction: approval of the exact draft, failure, retry without duplicate
  await expect(page.getByText(/Switch “Viewing as” to Program coordinator/)).toBeVisible();
  await asRole(page, "coordinator");
  await page.getByRole("button", { name: "Approve this exact draft" }).click();
  await page.getByLabel("Demo control: next simulated attempt").selectOption("reject");
  await page.getByRole("button", { name: "Send via simulated email" }).click();
  await expect(page.getByText("Failed — safe to retry")).toBeVisible();
  st = await state(page);
  expect(st.outbox).toHaveLength(0);
  await page.getByLabel("Demo control: next simulated attempt").selectOption("lost_ack");
  await page.getByRole("button", { name: /Retry \(attempt 2\)/ }).click();
  await expect(page.getByRole("button", { name: /Retry \(attempt 3\)/ })).toBeVisible();
  st = await state(page);
  expect(st.outbox).toHaveLength(1); // delivered, but ack lost
  await page.getByRole("button", { name: /Retry \(attempt 3\)/ }).click();
  await expect(page.getByText("Recorded (simulated)")).toBeVisible();
  st = await state(page);
  expect(st.outbox).toHaveLength(1); // no duplicate
  const intro = st.actions.find((a: { kind: string }) => a.kind === "introduction_email");
  expect(intro.attempts).toBe(3);
  expect(intro.history.map((h: { phase: string }) => h.phase)).toEqual(["plan", "approve", "act", "observe", "act", "observe", "act", "observe"]);
  await page.locator("#coord-title").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await shot(page, "05-coordination-retry");

  // Refresh persistence
  await page.reload();
  await expect(page.getByText("Introduced (simulated)").first()).toBeVisible();
  await expect(page.getByText("Recorded (simulated)")).toBeVisible();

  // 5. Meeting
  await asRole(page, "student:s-maya");
  await page.getByRole("radio", { name: "Tue evening" }).check();
  await page.getByRole("button", { name: "Draft calendar invitation" }).click();
  await page.getByRole("button", { name: "Approve this exact draft" }).click();
  await page.getByRole("button", { name: "Create via simulated calendar" }).click();
  await expect(page.getByText("Meeting scheduled (simulated)").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm the meeting was held" }).click();
  await expect(page.getByText("First meeting held").first()).toBeVisible();

  // 6. Milestones
  const boxes = page.locator(".milestones input[type=checkbox]");
  await expect(boxes).toHaveCount(4);
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.getByText("2 of 4 done")).toBeVisible();
  await page.getByRole("button", { name: /Draft follow-up/ }).click();
  await expect(page.getByText("Follow-up email", { exact: false }).first()).toBeVisible();
  await page.locator("#ms-title").scrollIntoViewIfNeeded();
  await shot(page, "06-match-milestones");

  // 7. Dashboard reflects actual state
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  const ledger = page.getByLabel("Cohort figures");
  await expect(ledger.getByText("Introductions recorded (simulated)")).toBeVisible();
  const figure = (title: string) => ledger.locator(".ledger-row", { hasText: title }).locator(".ledger-figure");
  await expect(figure("Introductions recorded")).toHaveText("1");
  await expect(figure("First meetings confirmed")).toContainText("1");
  await expect(figure("Development milestones")).toContainText("2of 4");
  await expect(figure("approved by both")).toContainText("1");
  await shot(page, "07-dashboard");

  // Refresh again: everything persists
  await page.reload();
  await expect(figure("Development milestones")).toContainText("2of 4");
});

test("consent withdrawal revokes the match and blocks stale approvals", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await page.goto("/cohort");
  await page.getByRole("button", { name: "Run allocation" }).first().click();
  const st = await state(page);
  const m = st.matches.find((x: { studentId: string }) => x.studentId === "s-aisha");
  await page.goto(`/matches/${m.id}`);
  await asRole(page, "student:s-aisha");
  await page.getByRole("button", { name: "Approve match" }).click();
  await asRole(page, "mentor:m-priya");
  await page.getByRole("button", { name: "Approve match" }).click();
  await asRole(page, "coordinator");
  await page.getByRole("button", { name: "Approve this exact draft" }).click();
  // Priya withdraws matching consent from the privacy page
  await asRole(page, "mentor:m-priya");
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await page.getByRole("checkbox", { name: /Visible for matching/ }).uncheck();
  await page.goto(`/matches/${m.id}`);
  await expect(page.getByText("Revoked — consent withdrawn").first()).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send via simulated email/ })).toHaveCount(0);
  const after = await state(page);
  expect(after.outbox).toHaveLength(0);
});

test("declining a match closes it and nothing is drafted", async ({ page }) => {
  await page.goto("/cohort");
  await page.getByRole("button", { name: "Run allocation" }).first().click();
  await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  await expect(page.getByText(/Greedy matching \(best pair first\) would total 425/)).toBeVisible();
  await page.locator("#result-title").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await shot(page, "04-cohort-allocation");
  const st = await state(page);
  const m = st.matches.find((x: { studentId: string; stage: string }) => x.studentId === "s-lucia" && x.stage === "proposed");
  await page.goto(`/matches/${m.id}`);
  await asRole(page, "mentor:m-elena");
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("This match was declined.")).toBeVisible();
  expect((await state(page)).actions.filter((a: { matchId: string }) => a.matchId === m.id)).toHaveLength(0);
});

test("document validation errors are shown clearly", async ({ page }) => {
  await page.goto("/onboard/student");
  await page.getByRole("checkbox", { name: /Store and process my reviewed profile/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Upload a resume").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf at all") });
  await page.getByRole("button", { name: "Extract fields for review" }).click();
  await expect(alerts(page)).toContainText("doesn’t look like a valid PDF");
  await page.getByLabel("Upload a resume").setInputFiles({ name: "resume.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await expect(alerts(page)).toContainText("Upload a PDF, .txt or .md file");
  // Injection sample is flagged
  await page.getByRole("button", { name: "Try the prompt-injection sample" }).click();
  await expect(page.getByText(/treated as data, not followed/)).toBeVisible();
  await expect(page.getByLabel("Skills")).toHaveValue("Financial modeling, Pitching");
  await shot(page, "08-injection-flagged");
  // AI option is honestly unavailable without credentials
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText(/no Gemini credentials configured|didn’t consent to external AI/)).toBeVisible();
});

test("automated accessibility scan (axe) on key pages", async ({ page }) => {
  for (const path of ["/", "/demo", "/onboard/student", "/onboard/alumni", "/cohort", "/matches", "/dashboard", "/privacy", "/how-it-works"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  }
});

test("keyboard: skip link and nav are reachable", async ({ page }) => {
  await page.goto("/demo");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
