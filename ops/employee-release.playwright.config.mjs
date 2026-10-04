import { defineConfig } from "../frontend/node_modules/@playwright/test/index.mjs";

export default defineConfig({
  testDir: "../frontend/e2e",
  testMatch: ["employee-edit.spec.ts", "preview-integration.spec.ts"],
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  reporter: "list",
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
