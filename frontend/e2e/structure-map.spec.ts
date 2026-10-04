import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const departments: Record<string, unknown>[] = [
    { id: "d1", name: "Производство", description: null, head_id: "e1", parent_id: null, company_id: "company" },
    { id: "d2", name: "Отдел ГБ", description: null, head_id: null, parent_id: "d1", company_id: "company" },
    { id: "d3", name: "Кадровый отдел", description: null, head_id: null, parent_id: null, company_id: "company" },
  ];
  const positions: Record<string, unknown>[] = [{ id: "p1", name: "Главный бухгалтер", department_id: "d2", company_id: "company" }];
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "HR", role: "company_admin", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/companies/company") body = { id: "company", name: "Отчет" };
    else if (path === "/api/v1/employees/") body = [
      { id: "e1", full_name: "Ольга Юнусова", department_id: "d1", position_id: null },
      { id: "e2", full_name: "Римма Адилова", department_id: "d2", position_id: "p1" },
    ];
    else if (path === "/api/v1/departments/" && request.method() === "POST") {
      body = { id: `d${departments.length + 1}`, description: null, head_id: null, company_id: "company", parent_id: null, ...request.postDataJSON() };
      departments.push(body as Record<string, unknown>);
    } else if (path === "/api/v1/departments/") body = departments;
    else if (path === "/api/v1/positions/" && request.method() === "POST") {
      body = { id: `p${positions.length + 1}`, company_id: "company", ...request.postDataJSON() };
      positions.push(body as Record<string, unknown>);
    } else if (path === "/api/v1/positions/") body = positions;
    await route.fulfill({ json: body });
  });
});

test("structure map shows nesting and creates departments and positions in place", async ({ page }) => {
  await page.goto("/dashboard/organization");
  await expect(page.getByRole("tab", { name: "Карта", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Отчет", { exact: true })).toBeVisible({ timeout: 2500 });
  await expect(page.getByRole("heading", { name: "Производство", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Отдел ГБ", exact: true })).toBeVisible();
  await expect(page.getByText("2 чел.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Должности: Отдел ГБ" })).toContainText("Главный бухгалтер");

  await page.getByRole("button", { name: "Новый отдел", exact: true }).click();
  const field = page.getByLabel("Новый отдел", { exact: true });
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByText("Введите название", { exact: true })).toBeVisible();
  await field.fill("Финансовый отдел");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Финансовый отдел", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Добавить подотдел в отдел Производство", exact: true }).click();
  await page.getByLabel("Новый подотдел в отделе Производство").fill("Отдел ведущих");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Отдел ведущих", exact: true, level: 4 })).toBeVisible();

  await page.getByRole("button", { name: "Добавить должность в отдел Производство", exact: true }).click();
  await page.getByLabel("Новая должность в отделе Производство").fill("Бухгалтер по выпискам");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("list", { name: "Должности: Производство" })).toContainText("Бухгалтер по выпискам");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/structure-map-${test.info().project.name}.png`, fullPage: true });
});

test("structure map edit dialog can move a department to another parent", async ({ page }) => {
  let patched: unknown = null;
  await page.route("**/api/v1/departments/d2", async route => {
    patched = route.request().postDataJSON();
    await route.fulfill({ json: { id: "d2", name: "Отдел ГБ", description: null, head_id: null, company_id: "company", ...(patched as object) } });
  });
  await page.goto("/dashboard/organization");
  await page.getByRole("button", { name: "Редактировать отдел Отдел ГБ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Редактирование отдела" });
  const parent = dialog.getByLabel("Входит в", { exact: true });
  await expect(parent).toHaveValue("d1");
  await parent.selectOption("");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(patched).toMatchObject({ parent_id: null });
  await expect(page.getByRole("heading", { name: "Отдел ГБ", exact: true, level: 3 })).toBeVisible();
});
