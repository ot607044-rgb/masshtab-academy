import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let employee = { id: "e1", full_name: "Иван Иванов", email: "ivan@example.org", phone: "123", department_id: "d1", position_id: "p1", company_id: "company", hire_date: "2026-09-01", status: "active", weak_areas: ["Налоги"] };
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "HR", role: "hr", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/departments/") body = [{ id: "d1", name: "Финансы", company_id: "company" }];
    else if (path === "/api/v1/positions/") body = [{ id: "p1", name: "Бухгалтер", company_id: "company" }, { id: "p2", name: "Главный бухгалтер", company_id: "company" }];
    else if (path === "/api/v1/employees/") body = [employee];
    else if (path === "/api/v1/workspace/employees/e1") body = { employee: { ...employee, department_name: employee.department_id ? "Финансы" : null, position_name: employee.position_id === "p2" ? "Главный бухгалтер" : employee.position_id ? "Бухгалтер" : null }, lessons_total: 1, lessons_completed: 0, completion_percent: 0, knowledge_percent: 50, weak_areas: employee.weak_areas, overdue_count: 0, roadmap: [], diagnostics: [], recruitment_history: [] };
    else if (path === "/api/v1/employees/e1" && route.request().method() === "PATCH") {
      employee = { ...employee, ...route.request().postDataJSON() };
      body = employee;
    }
    await route.fulfill({ json: body });
  });
});

test("profile edits status position contacts and hire date after reload", async ({ page }) => {
  await page.goto("/dashboard/employees/e1");
  await page.getByRole("tab", { name: "Профиль", exact: true }).click();
  const edit = page.getByRole("button", { name: "Редактировать профиль", exact: true });
  await expect(edit).toBeVisible({ timeout: 2500 });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Редактирование сотрудника" });
  await expect(dialog.getByLabel("ФИО *", { exact: true })).toHaveValue("Иван Иванов");
  await expect(dialog.getByLabel("Статус", { exact: true })).toHaveValue("active");
  await dialog.getByLabel("ФИО *", { exact: true }).fill("Иван Петров");
  await dialog.getByLabel("Email", { exact: true }).fill("");
  await dialog.getByLabel("Телефон", { exact: true }).fill("456");
  await dialog.getByLabel("Должность", { exact: true }).selectOption("p2");
  await dialog.getByLabel("Статус", { exact: true }).selectOption("vacation");
  await dialog.getByLabel("Дата приёма", { exact: true }).fill("2026-10-02");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Иван Петров", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Профиль", exact: true }).click();
  await edit.click();
  await expect(dialog.getByLabel("Статус", { exact: true })).toHaveValue("vacation");
  await expect(dialog.getByLabel("Должность", { exact: true })).toHaveValue("p2");
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Телефон", { exact: true })).toHaveValue("456");
  await expect(dialog.getByLabel("Дата приёма", { exact: true })).toHaveValue("2026-10-02");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/employee-editor-${test.info().project.name}.png`, fullPage: true });
});

test("list editor supports clearing fields cancellation and failed saves", async ({ page }) => {
  await page.goto("/dashboard/employees");
  const edit = page.getByRole("button", { name: "Редактировать сотрудника Иван Иванов", exact: true });
  await expect(edit).toBeVisible({ timeout: 2500 });
  await edit.click();
  await page.getByLabel("ФИО *", { exact: true }).fill("Не сохранять");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("link", { name: "Иван Иванов", exact: true })).toBeVisible();
  await edit.click();
  await page.getByLabel("Отдел", { exact: true }).selectOption("");
  await page.getByLabel("Должность", { exact: true }).selectOption("");
  await page.getByLabel("Дата приёма", { exact: true }).fill("");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await edit.click();
  await expect(page.getByLabel("Отдел", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Должность", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Дата приёма", { exact: true })).toHaveValue("");
  await page.route("**/api/v1/employees/e1", route => route.fulfill({ status: 403, json: { detail: "Доступ запрещён" } }));
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Доступ запрещён", { exact: true })).toBeVisible();
});
