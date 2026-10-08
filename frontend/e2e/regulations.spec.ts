import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const now = new Date().toISOString().replace("Z", "");
  const positions = [
    { id: "p1", name: "Главный бухгалтер", company_id: "c" },
    { id: "p2", name: "Бухгалтер", company_id: "c" },
  ];
  const regulations: Record<string, unknown>[] = [
    { id: "r1", position_id: "p2", company_id: "c", name: "Основной регламент", summary: "Полный функционал", status: "active", goal: "Корректный учёт", duties: ["Ведение учёта"], updated_by_name: "Юнусова Ольга", created_at: now, updated_at: now },
    { id: "r2", position_id: "p2", company_id: "c", name: "Банк и платежи", summary: "Специализация", status: "active", goal: "Финансовая прозрачность", duties: ["Платёжные поручения", "Сверка с банком"], updated_by_name: "Юнусова Ольга", created_at: now, updated_at: now },
    { id: "r3", position_id: "p1", company_id: "c", name: "Основной регламент", summary: null, status: "active", goal: null, duties: [], updated_by_name: null, created_at: now, updated_at: now },
  ];
  const assignments: Record<string, unknown>[] = [
    { id: "a1", employee_id: "e2", regulation_id: "r3", require_ack: true, acknowledged_at: now, assigned_at: now },
  ];
  const employees = [
    { id: "e1", full_name: "Адилова Римма", position_id: "p2", department_id: "d1", status: "active" },
    { id: "e2", full_name: "Громова Елена", position_id: "p1", department_id: "d1", status: "active" },
  ];
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "Юнусова Ольга", role: "company_admin", company_id: "c" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/positions/") body = positions;
    else if (path === "/api/v1/employees/") body = employees;
    else if (path === "/api/v1/departments/") body = [{ id: "d1", name: "Отдел ГБ", company_id: "c" }];
    else if (path === "/api/v1/regulations/" && method === "POST") {
      body = { id: `r${regulations.length + 1}`, company_id: "c", status: "active", goal: null, duties: [], summary: null, updated_by_name: "Юнусова Ольга", created_at: now, updated_at: now, ...request.postDataJSON() };
      regulations.push(body as Record<string, unknown>);
    } else if (path === "/api/v1/regulations/") body = regulations;
    else if (path === "/api/v1/regulations/assignments" && method === "POST") {
      const data = request.postDataJSON();
      const prev = assignments.findIndex(a => a.employee_id === data.employee_id);
      body = { id: `a${assignments.length + 1}`, acknowledged_at: null, assigned_at: now, notified: true, ...data };
      if (prev >= 0) assignments.splice(prev, 1);
      assignments.push(body as Record<string, unknown>);
    } else if (path === "/api/v1/regulations/assignments") body = assignments;
    else if (path.startsWith("/api/v1/regulations/r") && method === "PATCH") {
      const r = regulations.find(x => x.id === path.split("/").pop())!;
      Object.assign(r, request.postDataJSON());
      body = r;
    }
    await route.fulfill({ json: body });
  });
});

test("library: positions, variants, goal and adding duties", async ({ page }) => {
  await page.goto("/dashboard/regulations");
  await expect(page.getByRole("heading", { name: "Регламенты должностей" })).toBeVisible();
  const accountant = page.getByRole("button", { name: /Бухгалтер\s*2 варианта · 1 сотрудник/ });
  await accountant.click();
  await page.getByRole("button", { name: /Банк и платежи\s*Специализация/ }).click();
  await expect(page.getByText("Финансовая прозрачность")).toBeVisible();
  await expect(page.getByText("2 пункта в регламенте")).toBeVisible();

  await page.getByRole("button", { name: "Добавить пункт" }).click();
  await page.getByLabel("Текст обязанности").fill("Контроль поступлений");
  await page.getByLabel("Текст обязанности").press("Enter");
  await expect(page.getByText("3 пункта в регламенте")).toBeVisible();
  await expect(page.getByText("Контроль поступлений", { exact: true })).toBeVisible();
  await page.getByLabel("Текст обязанности").press("Escape");

  await page.getByRole("button", { name: "Изменить цель должности" }).click();
  await page.getByLabel("Цель должности").fill("Платежи без ошибок");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Платежи без ошибок")).toBeVisible();

  await page.getByRole("button", { name: "Новый вариант" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый вариант регламента" });
  await dialog.getByLabel("Название варианта *").fill("Учёт и отчётность");
  await dialog.getByRole("button", { name: "Создать вариант" }).click();
  await expect(page.getByRole("button", { name: /^Учёт и отчётность/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("button", { name: /Банк и платежи\s*Специализация/ }).click();
  await page.screenshot({ path: `../design-preview/implementation/regulations-library-${test.info().project.name}.png`, fullPage: true });
});

test("assignments: assign a variant with acknowledgement and see the result", async ({ page }) => {
  await page.goto("/dashboard/regulations");
  await page.getByRole("tab", { name: "Назначения сотрудникам" }).click();
  await expect(page.getByText("Громова Елена")).toBeVisible();
  await expect(page.getByText(/Ознакомлен/)).toBeVisible();

  await page.getByRole("button", { name: "Назначить регламент" }).click();
  const dialog = page.getByRole("dialog", { name: "Назначить регламент" });
  await dialog.getByRole("button", { name: /Адилова Римма/ }).click();
  await dialog.getByLabel("Найти сотрудника").fill("адил");
  await dialog.getByRole("button", { name: /Адилова Римма/ }).click();
  await expect(dialog.getByText("Бухгалтер · Отдел ГБ")).toBeVisible();
  await dialog.getByLabel("Вариант функционала").selectOption("r2");
  await expect(dialog.getByLabel("Запросить ознакомление")).toBeChecked();
  await page.screenshot({ path: `../design-preview/implementation/regulations-assign-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Назначить сотруднику" }).click();
  await expect(dialog.getByText("Регламент назначен")).toBeVisible();
  await expect(dialog.getByText(/получил уведомление/)).toBeVisible();
  await dialog.getByRole("button", { name: "Готово" }).click();
  await expect(dialog).not.toBeVisible();

  const card = page.getByRole("article").filter({ hasText: "Адилова Римма" });
  await expect(card.getByText("Банк и платежи")).toBeVisible();
  await expect(card.getByText("Ожидает ознакомления")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/regulations-assignments-${test.info().project.name}.png`, fullPage: true });
});
