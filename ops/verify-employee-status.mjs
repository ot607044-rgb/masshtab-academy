import { execFileSync, spawn } from "node:child_process";
import { chromium, expect } from "../frontend/node_modules/@playwright/test/index.mjs";

const host = "root@31.129.108.20";
const mint = `import asyncio,json
from datetime import timedelta
from sqlalchemy import select
from app.database import AsyncSessionLocal,engine
from app.models.user import User
from app.core.security import create_access_token
async def main():
 async with AsyncSessionLocal() as db:
  user=(await db.execute(select(User).where(User.is_active.is_(True),User.company_id.is_not(None),User.role.in_(['company_admin','hr'])).limit(1))).scalar_one()
  print(json.dumps({'token':create_access_token({'sub':str(user.id)},timedelta(minutes=2))}))
 await engine.dispose()
asyncio.run(main())`;
const credentials = JSON.parse(execFileSync("ssh", ["-o", "BatchMode=yes", host, "docker exec -i masshtab-academy-backend-1 python -"], { input: mint, encoding: "utf8" }));
const tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-L", "127.0.0.1:18082:127.0.0.1:80", host], { windowsHide: true, stdio: "ignore" });
let browser;
try {
  await new Promise(resolve => setTimeout(resolve, 1500));
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(token => localStorage.setItem("access_token", token), credentials.token);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
    await page.goto("http://127.0.0.1:18082/dashboard/employees");
    const response = await context.request.get("http://127.0.0.1:18082/api/v1/employees/", { headers: { Authorization: `Bearer ${credentials.token}` } });
    if (!response.ok()) throw new Error(`Employees API: ${response.status()}`);
    const data = await response.json();
    const working = data.filter(e => e.status !== "fired").length;
    const fired = data.length - working;
    await expect(page.getByRole("button", { name: `Работающие · ${working}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tbody tr")).toHaveCount(working);
    await expect(page.locator("tbody").getByText("Уволен", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `design-preview/implementation/production-employee-status-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: `Уволенные · ${fired}`, exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(fired);
    await page.reload();
    await expect(page.getByRole("button", { name: `Уволенные · ${fired}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: `Все · ${data.length}`, exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(data.length);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Horizontal overflow");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Verified ${width}px: working ${working}, fired ${fired}, total ${data.length}; read-only.`);
    await context.close();
  }
} finally { await browser?.close(); tunnel.kill(); }