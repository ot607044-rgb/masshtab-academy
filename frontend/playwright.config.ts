import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:5173", headless: true },
  reporter: "list",
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true },
});
