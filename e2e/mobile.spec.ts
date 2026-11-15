import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/demo", "/onboard/student", "/onboard/alumni", "/cohort", "/matches", "/dashboard", "/privacy", "/how-it-works"];

test("no horizontal overflow on mobile and the menu works", async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow on ${r}`).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.screenshot({ path: "submission/screenshots/mobile-landing.png" });
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Cohort" })).toBeVisible();
  await page.screenshot({ path: "submission/screenshots/mobile-menu.png" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Cohort" }).click();
  await expect(page).toHaveURL(/cohort/);
  await page.getByRole("button", { name: "Run allocation" }).first().click();
  await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "submission/screenshots/mobile-cohort.png", fullPage: false });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("trojan-mentor:state")!));
  await page.goto(`/matches/${st.matches[0].id}`);
  const o2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o2).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "submission/screenshots/mobile-match.png" });
});
