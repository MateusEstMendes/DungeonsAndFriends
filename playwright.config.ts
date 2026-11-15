import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:4179", browserName: "chromium", headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined), args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node apps/server/node_modules/tsx/dist/cli.mjs apps/server/scripts/board-e2e-host.ts",
    url: "http://127.0.0.1:4179/health", reuseExistingServer: false, timeout: 30_000,
  },
});
