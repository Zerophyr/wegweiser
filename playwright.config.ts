import { defineConfig } from "@playwright/test";
import path from "path";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: path.join(__dirname, "tests", "browser"),
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: isCi ? 1 : undefined,
  retries: isCi ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    headless: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
