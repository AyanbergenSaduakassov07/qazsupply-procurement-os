import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
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
      url: "http://localhost:3000/ru",
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
