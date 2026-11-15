import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:4179", browserName: "chromium", headless: true,
    launchOptions: { ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure", screenshot: "only-on-failure" },
});
