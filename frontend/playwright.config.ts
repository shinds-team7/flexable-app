import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/assert-local-api.ts",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Seoul",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
