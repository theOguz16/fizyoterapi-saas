import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4939";
const useExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./.next/playwright-results",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command:
          "NEXT_PUBLIC_API_BASE=http://127.0.0.1:4949/api NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_POSTHOG_KEY= pnpm exec next dev -p 4939",
        url: `${baseURL}/`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
