import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

/** Local Supabase publishes its (non-secret) publishable key via `supabase status`. */
function publishableKey(): string {
  if (process.env.SUPABASE_PUBLISHABLE_KEY) return process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    const out = execSync("supabase status --workdir infra -o json", { cwd: "..", stdio: "pipe" });
    return JSON.parse(out.toString()).PUBLISHABLE_KEY;
  } catch {
    return ""; // sign-in will show "unavailable"; auth tests fail loudly
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const external = !!process.env.E2E_BASE_URL; // servers already running (visual runs in Docker)
const webEnv = {
  API_URL: "http://localhost:8000",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: publishableKey(),
};

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", storageState: ".auth/clientAdminA.json" },
  // Baselines are Linux-only (rendered in the Playwright image, same as CI): no {platform} suffix.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  // Rendering is pinned to one Linux image, so noise is ~0: a missed menu item must fail.
  expect: { toHaveScreenshot: { maxDiffPixels: 100 } },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true },
      dependencies: ["setup"],
    },
    { name: "phone", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: "uv run uvicorn services.gateway.app:app --port 8000",
          cwd: "..",
          url: "http://localhost:8000/health",
          reuseExistingServer: !process.env.CI,
        },
        {
          command: process.env.CI
            ? "pnpm --filter @qazsupply/web build && pnpm --filter @qazsupply/web start"
            : "pnpm --filter @qazsupply/web dev",
          cwd: "..",
          env: webEnv,
          url: "http://localhost:3000/ru/sign-in",
          timeout: 180_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
