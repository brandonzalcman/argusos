import { defineConfig } from "@playwright/test";

const baseURL = process.env.ARGUS_E2E_BASE_URL ?? "http://127.0.0.1:4173";
const startWeb = process.env.ARGUS_E2E_START_WEB === "1";

export default defineConfig({
  testDir: "./specs",
  outputDir: "../../test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : "50%",
  reporter: [["list"], ["html", { outputFolder: "../../playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  ...(startWeb
    ? {
        webServer: {
          command: "pnpm --filter @argus/web dev -- --host 127.0.0.1 --port 4173",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
