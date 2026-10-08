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
  await expect(page.getByRole("tab", { name: "Оргструктура", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Отчет", { exact: true }).first()).toBeVisible({ timeout: 2500 });
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

test("structure map search, branch collapse and information card use CRM data", async ({ page }) => {
  await page.goto("/dashboard/organization");
  const card = page.getByRole("complementary", { name: "Информационная карточка" });
  await page.getByRole("heading", { name: "Производство", exact: true }).click();
  await expect(card).toContainText("Карточка отдела");
  await expect(card).toContainText("Ольга Юнусова");

  await page.getByRole("button", { name: "Свернуть ветки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Отдел ГБ", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Раскрыть ветки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Отдел ГБ", exact: true })).toBeVisible();

  await page.getByLabel("Поиск по структуре").fill("Римма");
  await expect(page.getByRole("heading", { name: "Кадровый отдел", exact: true })).toHaveCount(0);
  const employee = page.getByRole("button", { name: /Главный бухгалтер\s*Римма Адилова/ });
  await expect(employee).toBeVisible();
  await employee.click();
  await expect(card).toContainText("Карточка сотрудника");
  await expect(card).toContainText("Производство · Отдел ГБ");
  await expect(card).toContainText("Ольга Юнусова");

  await page.getByLabel("Поиск по структуре").fill("нет такого");
  await expect(page.getByText("Ничего не найдено по запросу «нет такого».")).toBeVisible();
});

test("structure map fits many branches into the screen width without horizontal scroll", async ({ page }) => {
  const names = ["Продажи", "Маркетинг", "Финансы", "Производство", "Логистика", "Кадры", "ИТ", "Юридический отдел"];
  await page.route("**/api/v1/departments/", route => route.fulfill({ json: names.map((name, i) => ({ id: `m${i}`, name, description: null, head_id: null, parent_id: null, company_id: "company" })) }));
  await page.route("**/api/v1/positions/", route => route.fulfill({ json: names.map((name, i) => ({ id: `mp${i}`, name: `Руководитель: ${name}`, department_id: `m${i}`, company_id: "company" })) }));
  await page.goto("/dashboard/organization");
  await expect(page.getByRole("heading", { name: "Юридический отдел", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Информационная карточка" })).toHaveCount(0);
  const canvas = page.getByRole("region", { name: "Оргструктура" });
  expect(await canvas.evaluate(el => { const sc = el.querySelector("div[class*=scroller]")!; return sc.scrollWidth <= sc.clientWidth + 1; })).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/structure-map-wide-${test.info().project.name}.png`, fullPage: true });

  await page.getByRole("heading", { name: "Финансы", exact: true }).click();
  const card = page.getByRole("complementary", { name: "Информационная карточка" });
  await expect(card).toContainText("Руководитель: Финансы");
  await page.screenshot({ path: `../design-preview/implementation/structure-map-card-${test.info().project.name}.png` });
  await card.getByRole("button", { name: "Закрыть карточку" }).click();
  await expect(card).toHaveCount(0);
});

test("drag and drop moves a position with its staff and reassigns an employee", async ({ page }) => {
  const patches: { path: string; body: Record<string, unknown> }[] = [];
  await page.route(/\/api\/v1\/(positions|employees)\/[a-z0-9]+$/, async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push({ path, body });
    const id = path.split("/").pop();
    const base = path.includes("positions")
      ? { id, name: "Главный бухгалтер", company_id: "company", department_id: "d2" }
      : { id, full_name: id === "e2" ? "Римма Адилова" : "Ольга Юнусова", company_id: "company", department_id: "d2", position_id: "p1" };
    await route.fulfill({ json: { ...base, ...body } });
  });
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/dashboard/organization");

  const role = page.getByRole("list", { name: "Должности: Отдел ГБ" }).getByText("Главный бухгалтер", { exact: true });
  await role.dragTo(page.getByRole("heading", { name: "Кадровый отдел", exact: true }));
  await expect(page.getByRole("list", { name: "Должности: Кадровый отдел" })).toContainText("Главный бухгалтер");
  expect(patches).toEqual([
    { path: "/api/v1/positions/p1", body: { department_id: "d3" } },
    { path: "/api/v1/employees/e2", body: { department_id: "d3" } },
  ]);
  await expect(page.getByRole("status")).toContainText("перенесена");

  patches.length = 0;
  await page.getByRole("button", { name: "Показать сотрудников: Без должности" }).click();
  const person = page.getByRole("button", { name: /Ольга Юнусова/ }).last();
  await person.dragTo(page.getByRole("list", { name: "Должности: Кадровый отдел" }).getByText("Главный бухгалтер", { exact: true }));
  expect(patches).toEqual([{ path: "/api/v1/employees/e1", body: { position_id: "p1", department_id: "d3" } }]);
});

test("company leadership level: add director, see subordinates, change heads in report", async ({ page }) => {
  const patches: { path: string; body: Record<string, unknown> }[] = [];
  await page.route(/\/api\/v1\/(employees|departments)\/[a-z0-9]+$/, async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push({ path, body });
    const id = path.split("/").pop();
    const base = path.includes("employees")
      ? { id, full_name: "Ольга Юнусова", company_id: "company", department_id: "d1", position_id: null }
      : { id, name: "Кадровый отдел", description: null, head_id: null, parent_id: null, company_id: "company" };
    await route.fulfill({ json: { ...base, ...body } });
  });
  await page.goto("/dashboard/organization");
  await page.getByRole("button", { name: "Добавить должность руководства" }).click();
  await page.getByLabel("Должность руководства").fill("Генеральный директор");
  await page.getByLabel("Сотрудник на должности").selectOption({ label: "Ольга Юнусова" });
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Генеральный директор", exact: true })).toBeVisible();
  expect(patches).toEqual([{ path: "/api/v1/employees/e1", body: { position_id: "p2", department_id: null } }]);
  await expect(page.getByRole("button", { name: /Ольга Юнусова\s*в подчинении 1 чел\. · прямых 1/ })).toBeVisible();
  await page.screenshot({ path: `../design-preview/implementation/structure-map-leadership-${test.info().project.name}.png` });

  await page.getByRole("button", { name: "Подчинённость" }).click();
  const report = page.getByRole("dialog", { name: "Отчёт по подчинению" });
  await expect(report.getByRole("row", { name: /Ольга Юнусова.*Генеральный директор/ })).toContainText("1");
  await report.getByLabel("Руководитель отдела Кадровый отдел").selectOption({ label: "Римма Адилова" });
  await expect.poll(() => patches.at(-1)).toEqual({ path: "/api/v1/departments/d3", body: { head_id: "e2" } });
  await report.getByRole("button", { name: "Закрыть отчёт" }).click();
  await expect(report).toHaveCount(0);
});

test("employee is shown in own department even if the position belongs to another, and can be moved between departments", async ({ page }) => {
  const patches: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/v1/employees/", route => route.fulfill({ json: [
    { id: "e1", full_name: "Ольга Юнусова", department_id: "d1", position_id: null },
    { id: "e2", full_name: "Римма Адилова", department_id: "d2", position_id: "p1" },
    { id: "e3", full_name: "Наталья Шерстнева", department_id: "d3", position_id: "p1" },
  ] }));
  await page.route(/\/api\/v1\/employees\/e\d$/, async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push({ path: new URL(route.request().url()).pathname, body });
    await route.fulfill({ json: { id: "e3", full_name: "Наталья Шерстнева", company_id: "company", department_id: "d3", position_id: "p1", ...body } });
  });
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/dashboard/organization");

  const hr = page.getByRole("list", { name: "Должности: Кадровый отдел" });
  await expect(hr).toContainText("Главный бухгалтер");
  await expect(hr).toContainText("должность отдела «Отдел ГБ»");
  await hr.getByRole("button", { name: "Показать сотрудников: Главный бухгалтер" }).click();
  await expect(hr.getByRole("button", { name: /Наталья Шерстнева/ })).toBeVisible();
  await page.getByRole("button", { name: "Показать сотрудников: Главный бухгалтер" }).first().click();
  await expect(page.getByRole("list", { name: "Должности: Отдел ГБ" })).not.toContainText("Наталья Шерстнева");

  await hr.getByRole("button", { name: /Наталья Шерстнева/ }).dragTo(page.getByRole("heading", { name: "Производство", exact: true }));
  expect(patches).toEqual([{ path: "/api/v1/employees/e3", body: { department_id: "d1", position_id: "p1" } }]);
  await expect(page.getByRole("list", { name: "Должности: Кадровый отдел" })).toHaveCount(0);
});

test("leadership position can be returned to a department or deleted", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/v1/positions/", route => route.request().method() === "GET"
    ? route.fulfill({ json: [
      { id: "p1", name: "Главный бухгалтер", department_id: "d2", company_id: "company" },
      { id: "t1", name: "РОБ Ведущих", department_id: null, company_id: "company" },
      { id: "t2", name: "Собственник", department_id: null, company_id: "company" },
    ] })
    : route.fallback());
  await page.route("**/api/v1/employees/", route => route.fulfill({ json: [
    { id: "e1", full_name: "Ольга Юнусова", department_id: "d1", position_id: null },
    { id: "e2", full_name: "Римма Адилова", department_id: "d2", position_id: "p1" },
    { id: "e4", full_name: "Ксения Андреева", department_id: null, position_id: "t1" },
  ] }));
  await page.route(/\/api\/v1\/(positions|employees)\/[a-z0-9]+$/, async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    calls.push(`${req.method()} ${path} ${req.postData() ?? ""}`);
    if (req.method() === "DELETE") return route.fulfill({ status: 204, body: "" });
    const body = req.postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: path.includes("positions")
      ? { id: path.split("/").pop(), name: "РОБ Ведущих", company_id: "company", ...body }
      : { id: "e4", full_name: "Ксения Андреева", company_id: "company", position_id: "t1", ...body } });
  });
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/dashboard/organization");

  await page.getByRole("button", { name: "Убрать из руководства РОБ Ведущих" }).click();
  const dialog = page.getByRole("dialog", { name: "Убрать из руководства" });
  await dialog.getByRole("combobox").selectOption({ label: "Кадровый отдел" });
  await dialog.getByRole("button", { name: "Перенести в отдел" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Должности: Кадровый отдел" })).toContainText("РОБ Ведущих");
  expect(calls).toEqual([
    'PATCH /api/v1/positions/t1 {"department_id":"d3"}',
    'PATCH /api/v1/employees/e4 {"department_id":"d3"}',
  ]);

  calls.length = 0;
  await page.getByRole("button", { name: "Убрать из руководства Собственник" }).click();
  await dialog.getByRole("button", { name: "Удалить должность" }).click();
  await expect(page.getByRole("heading", { name: "Собственник", exact: true })).toHaveCount(0);
  expect(calls).toEqual(["DELETE /api/v1/positions/t2 "]);
});

test("department edit dialog formats description, picks a font and switches departments", async ({ page }) => {
  const patches: Record<string, unknown>[] = [];
  await page.route(/\/api\/v1\/departments\/d\d$/, async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patches.push(body);
    const id = new URL(route.request().url()).pathname.split("/").pop();
    await route.fulfill({ json: { id, company_id: "company", head_id: null, parent_id: id === "d2" ? "d1" : null, ...body } });
  });
  await page.goto("/dashboard/organization");
  await page.getByRole("button", { name: "Редактировать отдел Производство", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Редактирование отдела" });
  await dialog.getByLabel("Описание", { exact: true }).fill("Продукт: Обученные сотрудники Работы: 1. Найм 2. Адаптация");
  await expect(dialog.getByText("Адаптация", { exact: true })).toBeVisible();
  await dialog.getByRole("toolbar").getByRole("combobox").first().selectOption("serif");
  await page.screenshot({ path: `../design-preview/implementation/department-edit-${test.info().project.name}.png` });

  await dialog.getByRole("button", { name: "Следующий отдел" }).click();
  await dialog.getByRole("button", { name: "Сохранить и перейти" }).click();
  await expect(dialog.getByLabel("Название отдела *")).toHaveValue("Отдел ГБ");
  expect(patches[0]).toMatchObject({ description_font: "serif", description: "Продукт: Обученные сотрудники Работы: 1. Найм 2. Адаптация" });
});
