import { execFileSync, spawn } from "node:child_process";
import { chromium } from "../frontend/node_modules/@playwright/test/index.mjs";

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
const tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-L", "127.0.0.1:18080:127.0.0.1:80", host], { windowsHide: true, stdio: "ignore" });
let browser;
try {
  await new Promise(resolve => setTimeout(resolve, 1800));
  browser = await chromium.launch();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(token => localStorage.setItem("access_token", token), credentials.token);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
    for (const path of ["workspace", "recruitment", "calendar", "materials", "organization", "hr-dashboard", "positions", "employees"]) {
      await page.goto(`http://127.0.0.1:18080/dashboard/${path}`);
      await page.waitForLoadState("networkidle");
      if (!await page.locator("h1").isVisible()) throw new Error(`Missing heading: ${path}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow: ${path}`);
      if (await page.getByText("Предварительная версия", { exact: false }).count()) throw new Error("Preview banner in production");
      if (path === "employees") {
        const edit = page.getByRole("button", { name: /^Редактировать сотрудника / }).first();
        const name = (await edit.getAttribute("aria-label")).replace("Редактировать сотрудника ", "");
        await edit.click();
        const dialog = page.getByRole("dialog", { name: "Редактирование сотрудника" });
        await dialog.getByLabel("ФИО *", { exact: true }).waitFor();
        if (await dialog.getByLabel("ФИО *", { exact: true }).inputValue() !== name) throw new Error("Employee value not loaded");
        await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
        await page.getByRole("link", { name, exact: true }).first().click();
        await page.getByRole("tab", { name: "Профиль", exact: true }).click();
        if (!await page.getByLabel("Загрузить фото сотрудника", { exact: true }).count()) throw new Error("Photo input missing");
        if (!await page.getByRole("button", { name: /^(Загрузить|Заменить) фото$/, exact: true }).isVisible()) throw new Error("Photo upload button missing");
        await page.getByRole("button", { name: "Редактировать профиль", exact: true }).click();
        await page.getByRole("dialog").getByLabel("Статус", { exact: true }).waitFor();
        await page.screenshot({ path: `design-preview/implementation/production-employee-editor-${viewport.width}.png`, fullPage: true });
        await page.getByRole("dialog").getByRole("button", { name: "Отмена", exact: true }).click();
      }
      if (path === "organization") {
        const edit = page.getByRole("button", { name: /^Редактировать отдел / }).first();
        const name = (await edit.getAttribute("aria-label")).replace("Редактировать отдел ", "");
        await edit.click();
        const dialog = page.getByRole("dialog", { name: "Редактирование отдела" });
        if (!await dialog.isVisible()) throw new Error("Department editor did not open");
        if (await dialog.getByLabel("Название отдела *", { exact: true }).inputValue() !== name) throw new Error("Department value not loaded");
        await page.screenshot({ path: `design-preview/implementation/production-department-editor-${viewport.width}.png`, fullPage: true });
        await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
      }
      if (path === "positions") {
        const edit = page.getByRole("button", { name: /^Редактировать должность / }).first();
        const name = (await edit.getAttribute("aria-label")).replace("Редактировать должность ", "");
        await edit.click();
        const dialog = page.getByRole("dialog", { name: "Редактирование должности" });
        if (!await dialog.isVisible()) throw new Error("Position editor did not open");
        if (await dialog.getByLabel("Название должности *", { exact: true }).inputValue() !== name) throw new Error("Position value not loaded");
        await page.screenshot({ path: `design-preview/implementation/production-position-editor-${viewport.width}.png`, fullPage: true });
        await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
      }
      console.log("PASS browser", viewport.width, path);
    }
    if (errors.length) throw new Error(errors.join("\n"));
    await page.screenshot({ path: `design-preview/implementation/production-${viewport.width}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser?.close();
  tunnel.kill();
}
