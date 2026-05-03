import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:2929";
const useExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "E2E_AUTH_BYPASS=true pnpm dev",
        url: "http://localhost:2929/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  reporter: [["list"]],
});
