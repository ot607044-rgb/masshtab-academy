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
const tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-L", "127.0.0.1:18083:127.0.0.1:80", host], { windowsHide: true, stdio: "ignore" });
let browser;
try {
  await new Promise(resolve => setTimeout(resolve, 1500));
  browser = await chromium.launch();
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript(token => localStorage.setItem("access_token", token), credentials.token);
    const page = await context.newPage();
    const errors=[];
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if(r.status()>=400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.route("**/*", r => ["GET","HEAD"].includes(r.request().method()) ? r.continue() : r.abort());
    for (const path of ["workspace", "employees", "recruitment", "materials", "organization"]) {
      await page.goto(`http://127.0.0.1:18083/dashboard/${path}`);
      await expect(page.locator("h1")).toBeVisible();
      if (path === "workspace") {
        await expect(page.locator(".academy-metrics > div").first()).toHaveCSS("background-color", "rgb(229, 241, 233)");
        await expect(page.locator(".academy-page-heading")).toHaveCSS("background-color", "rgb(237, 232, 251)");
      }
      if (path === "employees") {
        await page.locator("tbody tr td a").first().click();
        await page.getByRole("tab", { name:"Профиль", exact:true }).click();
        await expect(page.getByRole("heading",{name:"Данные сотрудника"})).toBeVisible();
        await page.screenshot({path:`design-preview/implementation/production-soft-palette-profile-${width}.png`,fullPage:true});
      }
      if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error(`Overflow: ${path} ${width}`);
    }
    if(errors.length) throw new Error(errors.join("\n"));
    console.log(`Soft palette verified: ${width}px, main screens and employee profile; no application errors.`);
    await context.close();
  }
} finally { await browser?.close(); tunnel.kill(); }