import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:4173", headless: true, viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort", url: "http://127.0.0.1:4173", reuseExistingServer: false },
  reporter: [["list"], ["html", { open: "never" }]],
});
