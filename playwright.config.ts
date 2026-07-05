import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Use the pre-installed Chromium when available (CI containers), otherwise
// fall back to Playwright's own download.
const chromiumPath = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173/pt-progression/",
    viewport: { width: 390, height: 844 }, // iPhone-ish
    launchOptions: existsSync(chromiumPath) ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173/pt-progression/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
