import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

const authFile = path.join("playwright", ".auth", "user.json");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4323",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /signin\.spec\.ts/],
    },
    {
      name: "chromium-unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [/signin\.spec\.ts/],
    },
  ],
  webServer: {
    // Production preview — React islands fail to hydrate on `astro dev` in Playwright (jsxDEV error).
    command: "npm run preview -- --port 4323",
    url: "http://localhost:4323",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
