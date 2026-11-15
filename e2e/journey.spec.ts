import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SHOTS = "submission/screenshots";
const shot = async (page: Page, name: string) => {
  await page.addStyleTag({ content: ".toast{display:none!important}" });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const alerts = (page: Page) => page.locator("[role=alert]:not(#__next-route-announcer__)");
const asRole = (page: Page, value: string) => page.getByLabel(/Signed in as/).selectOption(value);
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("trojan-mentor:state") || "null"));

test.describe.configure({ mode: "serial" });

test("complete journey: onboard → allocate → bilateral approval → intro with failure+retry → meeting → milestones → dashboard, persisting across refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your next chapter starts with a conversation.");
  await page.waitForTimeout(1300);
  await shot(page, "01-landing");
  // 1. Sign up as a student, using the simple (non-AI) reader
  await page.getByRole("link", { name: "I’m a student" }).click();
  await expect(page.getByRole("heading", { name: "Start with your resume" })).toBeVisible();
  await expect(page.getByText("Demo extraction · local text parser")).toBeVisible();
  await shot(page, "02-resume-step");
  await page.getByRole("button", { name: "Review profile" }).click();
  await expect(alerts(page)).toContainText("Choose a resume file first");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await expect(page.getByRole("heading", { name: "Check your details" })).toBeVisible();
  await expect(page.getByText("Read by the local text parser (not AI)")).toBeVisible();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Imani Castellanos-Reed");
  // Saving is blocked until availability + review confirmation
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(alerts(page).filter({ hasText: "Confirm you’ve checked" })).toBeVisible();
  await expect(alerts(page).filter({ hasText: "Agree to save your profile" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Tue evening" }).check();
  await page.getByRole("checkbox", { name: "Thu evening" }).check();
  await shot(page, "03-review-extracted-profile");
  await page.getByRole("checkbox", { name: /Save my profile/ }).check();
  await page.getByRole("checkbox", { name: /I’ve checked every detail/ }).check();
  await page.getByRole("button", { name: "Save profile" }).click();
  // Signing up lands in the new student's own home
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Imani");
  await expect(page.getByText(/next matching round/)).toBeVisible();
  await shot(page, "02b-student-home");

  // 2. Allocate as the coordinator
  await asRole(page, "coordinator");
  await page.goto("/cohort");
  await page.getByRole("button", { name: "Run allocation" }).click();
  await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not matched this round" })).toBeVisible();
  await expect(page.locator("main").getByText("Riley Brannigan-Cho").first()).toBeVisible();
  await expect(page.getByText(/close enough fit/).first()).toBeVisible();
  await shot(page, "04b-cohort-after-onboarding");
  let st = await state(page);
  expect(st.allocationRuns).toHaveLength(1);
  expect(st.allocationRuns[0].totalScore).toBeGreaterThanOrEqual(st.allocationRuns[0].greedyTotal);

  // 3. Bilateral approval on Maya & Daniel
  const maya = st.matches.find((m: { studentId: string; mentorId: string }) => m.studentId === "s-maya");
  expect(maya.mentorId).toBe("m-daniel");
  await page.goto(`/matches/${maya.id}`);
  await expect(page.getByRole("heading", { name: "Both need to say yes" })).toBeVisible();
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
  await expect(page.getByText(/Waiting for the program coordinator to approve/)).toBeVisible();
  await asRole(page, "coordinator");
  await page.getByRole("button", { name: "Approve this exact draft" }).click();
  await page.getByLabel(/next attempt will/).selectOption("reject");
  await page.getByRole("button", { name: "Send via simulated email" }).click();
  await expect(page.getByText("Failed, safe to retry")).toBeVisible();
  st = await state(page);
  expect(st.outbox).toHaveLength(0);
  await page.getByLabel(/next attempt will/).selectOption("lost_ack");
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
  await page.getByRole("radio", { name: "Tuesday evenings" }).check();
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
  await page.goto("/dashboard");
  const ledger = page.getByLabel("Cohort figures");
  const figure = (label: string) => ledger.locator(".funnel-row", { has: page.getByText(label, { exact: true }) }).locator(".funnel-n");
  await expect(figure("Introduced")).toHaveText("1");
  await expect(figure("Met")).toHaveText("1");
  await expect(figure("Both said yes")).toHaveText("1");
  await expect(ledger).toContainText("2 of 4 milestones done");
  await shot(page, "07-dashboard");

  // Refresh again: everything persists
  await page.reload();
  await expect(ledger).toContainText("2 of 4 milestones done");
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
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download this profile’s data" }).click()]);
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile((await json.path())!, "utf8"));
  expect(exported.profile.id).toBe("m-priya");
  expect(exported.matches).toHaveLength(2);
  await page.getByRole("checkbox", { name: /Include me in matching/ }).uncheck();
  await page.goto(`/matches/${m.id}`);
  await expect(page.getByText("Revoked after consent was withdrawn").first()).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send via simulated email/ })).toHaveCount(0);
  const after = await state(page);
  expect(after.outbox).toHaveLength(0);
});

test("declining a match closes it and nothing is drafted", async ({ page }) => {
  await page.goto("/cohort");
  await page.getByRole("button", { name: "Run allocation" }).first().click();
  await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  await expect(page.locator(".compare")).toContainText("425");
  await expect(page.locator(".compare")).toContainText("461");
  await page.locator("#why-title").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await shot(page, "04-cohort-allocation");
  // What-if insights: an extra seat for Elena matches Kenji; Riley's direction is uncovered
  const insights = page.locator("section", { has: page.getByRole("heading", { name: "Where more mentors would help" }) });
  await expect(insights).toContainText(/One more place with Elena .* would match Kenji/);
  await expect(insights).toContainText("No alum covers marine science and research");
  await insights.scrollIntoViewIfNeeded();
  await shot(page, "09-cohort-insights");
  // CSV export
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export allocation (CSV)" }).click()]);
  expect(dl.suggestedFilename()).toBe("trojan-mentor-cohort.csv");
  const csv = await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8");
  expect(csv.split("\r\n").filter((l) => l.startsWith("unmatched"))).toHaveLength(2);
  // Home: Elena sees a decision waiting, with a badge on Home
  await asRole(page, "mentor:m-elena");
  await expect(page.getByLabel("1 waiting")).toBeVisible();
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Elena");
  await expect(page.getByText(/Decide on your proposed match with Lucía/).first()).toBeVisible();
  await shot(page, "10-inbox");
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
  await page.getByLabel("Upload a resume").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf at all") });
  await expect(page.getByText("resume.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Review profile" }).click();
  await expect(alerts(page)).toContainText("doesn’t look like a valid PDF");
  await page.getByLabel("Upload a resume").setInputFiles({ name: "resume.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await expect(alerts(page)).toContainText("Use a PDF, .txt or .md file");
  // A real PDF (fictional sample) is read by the simple reader
  await page.getByLabel("Upload a resume").setInputFiles("public/samples/sample-resume-fictional.pdf");
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  await page.getByRole("button", { name: "Review profile" }).click();
  await expect(page.getByLabel(/Full name/)).toHaveValue("Dev Okafor-Lindgren");
  await expect(page.getByLabel("Skills")).toHaveValue("Figma, User research, Storytelling, Public speaking");
  await page.getByRole("button", { name: /Back to resume/ }).click();
  // Injection sample is flagged
  await page.getByText("How your resume is processed").click();
  await page.getByRole("button", { name: "a resume that hides instructions" }).click();
  await expect(page.getByText(/treated as data, not followed/)).toBeVisible();
  await expect(page.getByLabel("Skills")).toHaveValue("Financial modeling, Pitching");
  await shot(page, "08-injection-flagged");
  // AI is never used without explicit permission; the status line says which reader will run
  await page.getByRole("button", { name: /Back to resume/ }).click();
  await expect(page.getByText("Demo extraction · local text parser")).toBeVisible();
  const ai = page.getByRole("checkbox", { name: /Let Google’s Gemini read my resume/ });
  if (await ai.count()) {
    await ai.check();
    await expect(page.getByText("AI extraction · Google Gemini, with your permission")).toBeVisible();
    await expect(page.getByText(/also sent to Google’s Gemini/)).toBeVisible();
    await ai.uncheck();
  }
});

test("automated accessibility scan (axe) on key pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // measure settled colors, not mid-animation frames
  for (const path of ["/", "/home", "/profile", "/onboard/student", "/onboard/alumni", "/cohort", "/matches", "/dashboard", "/privacy", "/how-it-works"]) {
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

test("people can edit their own profile and it persists", async ({ page }) => {
  await page.goto("/home");
  await asRole(page, "student:s-riley");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Riley");
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByLabel("Target roles").fill("Data scientist, Marine biologist");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByText(/Data scientist, Marine biologist/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Data scientist, Marine biologist/)).toBeVisible();
  // Alumni can't lower capacity below active mentees, and can pause from home
  await asRole(page, "mentor:m-marcus");
  await page.goto("/home");
  await page.getByRole("checkbox", { name: /Open to new students/ }).uncheck();
  await expect(page.getByText(/not taking new students/)).toBeVisible();
});
