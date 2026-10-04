import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let position = { id: "p1", company_id: "company", name: "Бухгалтер", description: "Учет", department_id: "d1", required_skills: ["Excel"] };
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "HR", role: "hr", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/departments/") body = [{ id: "d1", name: "Финансы" }];
    else if (path === "/api/v1/positions/") body = [position];
    else if (path === "/api/v1/positions/p1" && route.request().method() === "PATCH") {
      position = { ...position, ...route.request().postDataJSON() };
      body = position;
    }
    await route.fulfill({ json: body });
  });
});

test("position editor loads values and persists edits after reload", async ({ page }) => {
  await page.goto("/dashboard/positions");
  await page.getByRole("button", { name: "Редактировать должность Бухгалтер" }).click();
  const dialog = page.getByRole("dialog", { name: "Редактирование должности" });
  await expect(dialog.getByLabel("Название должности *", { exact: true })).toHaveValue("Бухгалтер");
  await expect(dialog.getByLabel("Описание", { exact: true })).toHaveValue("Учет");
  await expect(dialog.getByLabel("Отдел", { exact: true })).toHaveValue("d1");
  await dialog.getByLabel("Название должности *", { exact: true }).fill("Главный бухгалтер");
  await dialog.getByLabel("Описание", { exact: true }).fill("");
  await dialog.getByLabel("Отдел", { exact: true }).selectOption("");
  await dialog.getByRole("button", { name: "Удалить навык Excel" }).click();
  await dialog.getByLabel("Добавить навык").fill("Налоги");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByText("Главный бухгалтер", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать должность Главный бухгалтер" }).click();
  await expect(dialog.getByLabel("Отдел", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Описание", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Удалить навык Налоги" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/position-editor-${test.info().project.name}.png`, fullPage: true });
});

test("cancel leaves position unchanged and failed save keeps editor open", async ({ page }) => {
  await page.goto("/dashboard/positions");
  await page.getByRole("button", { name: "Редактировать должность Бухгалтер" }).click();
  await page.getByLabel("Название должности *", { exact: true }).fill("Не сохранять");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByText("Бухгалтер", { exact: true })).toBeVisible();
  await page.route("**/api/v1/positions/p1", route => route.fulfill({ status: 403, json: { detail: "Доступ запрещён" } }));
  await page.getByRole("button", { name: "Редактировать должность Бухгалтер" }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Доступ запрещён", { exact: true })).toBeVisible();
});
