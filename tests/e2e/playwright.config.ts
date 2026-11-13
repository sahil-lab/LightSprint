import { defineConfig, devices } from "@playwright/test";

const resultsDir = process.env.RESULTS_DIR ?? "results";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  // The suite draws WebGL with a software renderer on one bounded CPU, which is slow.
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: `${resultsDir}/test-results`,
  reporter: [
    ["list"],
    ["junit", { outputFile: `${resultsDir}/junit.xml` }],
    ["json", { outputFile: `${resultsDir}/results.json` }],
    ["html", { open: "never", outputFolder: `${resultsDir}/html` }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:18105",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
