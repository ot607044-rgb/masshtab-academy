import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const candidate = { id: "c1", full_name: "Мария Иванова", vacancy_id: "v1", vacancy_title: "Бухгалтер", stage: "new", source: "manual", email: "maria@example.org", phone: null, notes: null, history: [], employee_id: null, created_at: "2026-10-04T10:00:00Z" };
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "Ольга", role: "hr", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/workspace/dashboard") body = { stats: { vacancies: 8, candidates: 46, onboarding: 14, needs_attention: 1 }, attention: [{ employee_id: "e1", full_name: "Анна Смирнова", kind: "overdue", title: "Просрочено обучение", detail: "Уроков: 1" }], meetings: [], employees: [{ employee_id: "e1", full_name: "Анна Смирнова", position_name: "Бухгалтер", department_name: "Финансы", lessons_completed: 4, lessons_total: 5, completion_percent: 80, knowledge_percent: 58, weak_areas: ["Налоговые платежи"] }] };
    else if (path === "/api/v1/recruitment/vacancies") body = [{ id: "v1", title: "Бухгалтер", status: "open" }];
    else if (path === "/api/v1/recruitment/candidates") body = [candidate];
    else if (path === "/api/v1/recruitment/candidates/c1") {
      if (route.request().method() === "PATCH") Object.assign(candidate, route.request().postDataJSON());
      body = candidate;
    }
    else if (path === "/api/v1/workspace/employees/e1") body = { employee: { id: "e1", full_name: "Анна Смирнова", position_name: "Бухгалтер", department_name: "Финансы", status: "probation", hire_date: "2026-09-15", email: "anna@example.org", phone: null }, lessons_completed: 4, lessons_total: 5, completion_percent: 80, knowledge_percent: 58, overdue_count: 1, weak_areas: ["Налоговые платежи"], roadmap: [{ id: "a1", lesson_id: "l1", title: "Налоговые платежи", status: "assigned", due_date: "2026-10-01", overdue: true, is_remediation: true, duration_minutes: 25 }], diagnostics: [{ test_id: "t1", title: "Основы учета", topic: "Налоговые платежи", score: 58, passing_score: 70, passed: false, attempts: 2, completed_at: "2026-10-04T10:00:00Z" }], recruitment_history: [{ stage: "hired", at: "2026-09-15T10:00:00Z" }] };
    await route.fulfill({ json: body });
  });
});

test("HR workspace opens and links to employee roadmap", async ({ page }) => {
  await page.goto("/dashboard/workspace");
  await expect(page.getByRole("heading", { name: "Рабочий стол", exact: true })).toBeVisible();
  await expect(page.getByText("Активные вакансии", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Открыть маршрут" }).first().click();
  await expect(page.getByRole("heading", { name: "Анна Смирнова" })).toBeVisible();
  await expect(page.getByText("Назначено автоматически", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `../design-preview/implementation/employee-roadmap-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("tab", { name: "Знания и тесты" }).click();
  await expect(page.getByText("Основы учета", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/employee-${test.info().project.name}.png`, fullPage: true });
});

test("candidate moves between stages using the API", async ({ page }) => {
  await page.goto("/dashboard/recruitment");
  await expect(page.getByRole("heading", { name: "Подбор", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Мария Иванова", exact: true }).click();
  await page.getByLabel("Этап подбора").selectOption("interview");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('[data-stage="interview"]').getByText("Мария Иванова")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/recruitment-${test.info().project.name}.png`, fullPage: true });
});

test("dashboard and mobile navigation render without overflow", async ({ page }) => {
  await page.goto("/dashboard/workspace");
  await expect(page.getByRole("heading", { name: "Рабочий стол", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/dashboard-${test.info().project.name}.png`, fullPage: true });
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("link", { name: "Календарь", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Календарь", exact: true })).toBeVisible();
});
