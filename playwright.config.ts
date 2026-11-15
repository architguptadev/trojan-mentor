import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const REMOTE = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: REMOTE ?? `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: REMOTE ? undefined : {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1500, height: 1000 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
