import { defineConfig } from "@playwright/test";
import chromium, { inflate, setupLambdaEnvironment } from "@sparticuz/chromium";

// npm-hosted Chromium keeps CI reproducible when cdn.playwright.dev is blocked.
chromium.setGraphicsMode = false;
if (!process.env.BROWSER_EXECUTABLE) {
  await inflate("node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  setupLambdaEnvironment("/tmp/al2023/lib");
}
const executablePath = process.env.BROWSER_EXECUTABLE || await chromium.executablePath();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  outputDir: ".tmp/browser-results",
  use: {
    baseURL: "https://localhost:4599",
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: "node --import tsx e2e/server.mjs",
    url: "https://localhost:4599/health",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
