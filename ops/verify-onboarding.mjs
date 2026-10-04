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
const tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-L", "127.0.0.1:18081:127.0.0.1:80", host], { windowsHide: true, stdio: "ignore" });
let browser;
try {
  await new Promise(resolve => setTimeout(resolve, 1500));
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(token => localStorage.setItem("access_token", token), credentials.token);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
    await page.goto("http://127.0.0.1:18081/dashboard");
    await expect(page.getByRole("heading", { name: "С чего начать", exact: true })).toBeVisible();
    await expect(page.getByText("Предварительная версия", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Опубликовать", { exact: false }).first()).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow at ${width}`);
    await page.screenshot({ path: `design-preview/implementation/production-onboarding-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Показать экскурсию" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Шаг 1 из 4")).toBeVisible();
    for (let i = 0; i < 3; i++) await dialog.getByRole("button", { name: "Далее", exact: true }).click();
    await dialog.getByRole("button", { name: "Завершить экскурсию" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Перейти к работе", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Рабочий стол", exact: true })).toBeVisible();
    await page.goto("http://127.0.0.1:18081/dashboard");
    await expect(page).toHaveURL(/\/dashboard\/workspace$/);
    if (width === 390) await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("link", { name: "С чего начать", exact: true }).click();
    await expect(page.getByRole("heading", { name: "С чего начать", exact: true })).toBeVisible();
    if (errors.length) throw new Error(errors.join("\n"));
    await context.close();
    console.log(`Production onboarding verified at ${width}px; no application errors; read-only API requests.`);
  }
} finally {
  await browser?.close();
  tunnel.kill();
}
