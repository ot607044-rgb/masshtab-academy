import { defineConfig } from '../frontend/node_modules/@playwright/test/index.mjs';
export default defineConfig({
  testDir: '../frontend/e2e', testMatch: 'test-editor.spec.ts',
  use: { baseURL: 'http://localhost:5178', headless: true }, reporter: 'list',
  projects: [{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
  webServer: {command:'npm run preview -- --host 127.0.0.1 --port 5178 --strictPort',cwd:'C:/programm/obychenie/academy-tests-release/frontend',url:'http://localhost:5178',reuseExistingServer:false}
});
