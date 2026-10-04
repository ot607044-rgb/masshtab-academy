import { test, expect } from "@playwright/test";
import type { TestDetail } from "../src/types";

test.beforeEach(async ({ page }) => {
  let sequence = 1;
  let item: TestDetail = {
    id: "test-1", company_id: "company", author_id: "u1", title: "Стандарты работы с клиентами",
    description: "Проверка клиентского сервиса", passing_score: 70, max_attempts: 3, time_limit_minutes: 20,
    position_id: null, topic_id: null, lesson_id: null, status: "draft", created_at: "2026-10-04", updated_at: "2026-10-04",
    questions: [{ id: "q1", text: "С чего начать разговор с клиентом?", question_type: "single", explanation: "Выясните потребность клиента.", points: 1, order_index: 0,
      options: [{ id: "o1", text: "Рассказать об акциях", is_correct: false, order_index: 0 }, { id: "o2", text: "Уточнить запрос", is_correct: true, order_index: 1 }] }],
  };
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "HR", role: "hr", company_id: "company" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/tests/") {
      if (request.method() === "POST") { item = { ...item, ...request.postDataJSON(), questions: [] }; body = item; }
      else body = [item];
    } else if (path === "/api/v1/tests/test-1") {
      if (request.method() === "PATCH") item = { ...item, ...request.postDataJSON() };
      body = item;
    } else if (path === "/api/v1/tests/test-1/questions") {
      const data = request.postDataJSON();
      item.questions.push({ ...data, id: `q${++sequence}`, options: data.options.map((o: object, i: number) => ({ ...o, id: `o${sequence}-${i}` })) });
      body = item;
    } else if (path.includes("/questions/")) {
      const id = path.split("/").at(-1);
      if (request.method() === "DELETE") item.questions = item.questions.filter(q => q.id !== id);
      else item.questions = item.questions.map(q => q.id === id ? { ...q, ...request.postDataJSON() } : q);
      body = item;
    } else if (path.endsWith("/publish")) { item.status = "published"; body = item; }
    await route.fulfill({ json: body });
  });
});

test("create opens an editor, saves questions and survives reload", async ({ page }) => {
  await page.goto("/dashboard/materials?tab=tests");
  await page.getByRole("button", { name: /Создать тест/ }).click();
  await expect(page).toHaveURL(/\/tests\/new$/);
  await page.getByLabel("Название теста", { exact: true }).fill("Новый вводный тест");
  await page.getByLabel("Вопрос", { exact: true }).fill("Как начать разговор?");
  await page.getByLabel("Вариант ответа 1", { exact: true }).fill("Поздороваться");
  await page.getByLabel("Вариант ответа 2", { exact: true }).fill("Промолчать");
  await page.getByLabel("Правильный ответ 1", { exact: true }).check();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page).toHaveURL(/\/tests\/test-1$/);
  await page.reload();
  await expect(page.getByLabel("Название теста", { exact: true })).toHaveValue("Новый вводный тест");
  await expect(page.getByLabel("Вопрос", { exact: true })).toHaveValue("Как начать разговор?");
  await expect(page.getByLabel("Правильный ответ 1", { exact: true })).toBeChecked();
});

test("yes/no correct answer and settings persist; draft preview consumes no attempts", async ({ page }) => {
  const attemptCalls: string[] = [];
  page.on("request", r => { if (/\/(start|submit)$/.test(r.url())) attemptCalls.push(r.url()); });
  await page.goto("/dashboard/tests/test-1");
  await page.getByLabel("Тип вопроса").selectOption("yes_no");
  await page.getByLabel("Правильный ответ 2", { exact: true }).check();
  await page.getByRole("tab", { name: "Настройки теста" }).click();
  await page.getByLabel("Проходной балл, %").fill("80");
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByText("Все изменения сохранены", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Правильный ответ 2", { exact: true })).toBeChecked();
  await page.getByRole("tab", { name: "Настройки теста" }).click();
  await expect(page.getByLabel("Проходной балл, %")).toHaveValue("80");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.getByRole("heading", { name: "С чего начать разговор с клиентом?" })).toBeVisible();
  await page.getByLabel("Нет", { exact: true }).check();
  await page.getByRole("button", { name: "Ответить", exact: true }).click();
  await expect(page.getByText("Верно", { exact: true })).toBeVisible();
  expect(attemptCalls).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("invalid publication and failed saves keep question edits", async ({ page }) => {
  await page.goto("/dashboard/tests/test-1");
  await page.getByRole("button", { name: "Добавить вопрос", exact: true }).click();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Вопрос 2");
  await page.getByRole("button", { name: /Вопрос 1:/ }).click();
  await page.getByLabel("Вопрос", { exact: true }).fill("Изменение не должно потеряться");
  await page.route("**/api/v1/tests/test-1/questions/q1", r => r.fulfill({ status: 500, json: { detail: "Не удалось сохранить вопрос" } }));
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить вопрос");
  await expect(page.getByLabel("Вопрос", { exact: true })).toHaveValue("Изменение не должно потеряться");
});

test("editor has responsive question navigation and settings", async ({ page }) => {
  await page.goto("/dashboard/tests/test-1");
  await expect(page.getByLabel("Вопрос", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/test-editor-${test.info().project.name}.png`, fullPage: true });
});
