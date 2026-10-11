import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run stream:server",
      url: "http://127.0.0.1:8765/",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ADAPTER: "mock", PORT: "8765", HOST: "127.0.0.1" },
    },
    {
      command: "npm run preview -w @robot-face/demo-web -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
