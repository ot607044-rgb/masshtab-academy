import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let department = { id: "d1", name: "Финансы", description: "Учет", head_id: "e1", company_id: "company" };
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "HR", role: "hr", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/employees/") body = [{ id: "e1", full_name: "Иван Иванов", department_id: "d1" }];
    else if (path === "/api/v1/departments/") body = [department];
    else if (path === "/api/v1/departments/d1" && route.request().method() === "PATCH") {
      department = { ...department, ...route.request().postDataJSON() };
      body = department;
    }
    await route.fulfill({ json: body });
  });
});

test("department editor loads and saves values without losing employees", async ({ page }) => {
  await page.goto("/dashboard/organization");
  const edit = page.getByRole("button", { name: "Редактировать отдел Финансы", exact: true });
  await expect(edit).toBeVisible({ timeout: 2500 });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Редактирование отдела" });
  await expect(dialog.getByLabel("Название отдела *", { exact: true })).toHaveValue("Финансы");
  await expect(dialog.getByLabel("Описание", { exact: true })).toHaveValue("Учет");
  await expect(dialog.getByLabel("Руководитель", { exact: true })).toHaveValue("e1");
  await dialog.getByLabel("Название отдела *", { exact: true }).fill("Бухгалтерия");
  await dialog.getByLabel("Описание", { exact: true }).fill("");
  await dialog.getByLabel("Руководитель", { exact: true }).selectOption("");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Бухгалтерия", exact: true })).toBeVisible();
  await expect(page.getByText("1 чел.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать отдел Бухгалтерия", exact: true }).click();
  await expect(dialog.getByLabel("Описание", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Руководитель", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/department-editor-${test.info().project.name}.png`, fullPage: true });
});

test("department cancel and failed save do not discard values", async ({ page }) => {
  await page.goto("/dashboard/departments");
  const edit = page.getByRole("button", { name: "Редактировать отдел Финансы", exact: true });
  await expect(edit).toBeVisible({ timeout: 2500 });
  await edit.click();
  await page.getByLabel("Название отдела *", { exact: true }).fill("Не сохранять");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Финансы", exact: true })).toBeVisible();
  await page.route("**/api/v1/departments/d1", route => route.fulfill({ status: 403, json: { detail: "Доступ запрещён" } }));
  await edit.click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Доступ запрещён", { exact: true })).toBeVisible();
});
