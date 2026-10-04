import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const employees = [
    { id: "a", full_name: "Анна Активная", status: "active", department_id: "d1" },
    { id: "p", full_name: "Пётр Испытательный", status: "probation", department_id: "d1" },
    { id: "v", full_name: "Вера Отпуск", status: "vacation", department_id: "d2" },
    { id: "f", full_name: "Фёдор Уволенный", status: "fired", department_id: "d1" },
  ].map(e => ({ ...e, company_id: "company", email: null, phone: null, position_id: null, hire_date: null, weak_areas: [], photo_url: null }));
  await page.addInitScript(() => localStorage.setItem("access_token", "fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/auth/me")) body = { id: "u1", full_name: "HR", role: "hr", company_id: "company" };
    else if (path.includes("count")) body = { count: 0 };
    else if (path === "/api/v1/employees/") body = employees;
    else if (path.startsWith("/api/v1/departments")) body = [{ id: "d1", name: "Бухгалтерия" }, { id: "d2", name: "Кадры" }];
    else if (path === "/api/v1/employees/a" && route.request().method() === "PATCH") {
      Object.assign(employees[0], route.request().postDataJSON());
      body = employees[0];
    }
    await route.fulfill({ json: body });
  });
});

test("working list excludes fired staff; dismissal and restoration update counts immediately", async ({ page }) => {
  await page.goto("/dashboard/employees");
  await expect(page.getByRole("button", { name: "Работающие · 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Фёдор Уволенный", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Редактировать сотрудника Анна Активная", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Статус", { exact: true }).selectOption("fired");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Анна Активная", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Работающие · 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Уволенные · 2", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("button", { name: "Уволенные · 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Редактировать сотрудника Анна Активная", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Статус", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Все · 4", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("status combines with search and department and survives reload", async ({ page }) => {
  await page.goto("/dashboard/employees");
  for (const [name, employee] of [["Активные", "Анна Активная"], ["Испытательный срок", "Пётр Испытательный"], ["В отпуске", "Вера Отпуск"], ["Уволенные", "Фёдор Уволенный"]]) {
    await page.getByRole("button", { name: `${name} · 1`, exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: employee, exact: true })).toBeVisible();
  }
  await page.getByRole("combobox", { name: "Фильтр по отделу" }).selectOption("d1");
  await page.getByPlaceholder("Имя или email").fill("Фёдор");
  await page.reload();
  await expect(page.getByRole("button", { name: "Уволенные · 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Фильтр по отделу" })).toHaveValue("d1");
  await expect(page.getByPlaceholder("Имя или email")).toHaveValue("Фёдор");
  await page.getByRole("combobox", { name: "Фильтр по отделу" }).selectOption("d2");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Уволенные · 0", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/employee-status-${test.info().project.name}.png`, fullPage: true });
});
