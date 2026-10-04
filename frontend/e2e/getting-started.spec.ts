import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page, role = "hr", id = "guide-user") {
  await page.addInitScript(() => localStorage.setItem("access_token", "fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/auth/me")) body = { id, full_name: "Анна", role, company_id: "guide-company" };
    else if (path.includes("count")) body = { count: 0 };
    else if (path.endsWith("/workspace/dashboard")) body = { stats: { vacancies: 0, candidates: 0, onboarding: 0, needs_attention: 0 }, attention: [], meetings: [], employees: [] };
    await route.fulfill({ json: body });
  });
}

test("first visit guides HR; returning user resumes work and can reopen guide", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "С чего начать", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/start-hr-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "Открыть структуру компании" }).click();
  await expect(page).toHaveURL(/\/dashboard\/organization$/);
  await page.goto("/dashboard/start");
  await page.getByRole("button", { name: "Перейти к работе", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/workspace$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/workspace$/);
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("link", { name: "С чего начать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "С чего начать", exact: true })).toBeVisible();
});

test("tour supports back, skip, restart, completion and keyboard dismissal", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/start");
  const launch = page.getByRole("button", { name: "Показать экскурсию" });
  await launch.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Шаг 1 из 4")).toBeVisible();
  await dialog.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(dialog.getByText("Шаг 2 из 4")).toBeVisible();
  await page.screenshot({ path: `../design-preview/implementation/start-tour-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(dialog.getByText("Шаг 1 из 4")).toBeVisible();
  await dialog.getByRole("button", { name: "Пропустить экскурсию" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(launch).toBeFocused();
  await launch.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await launch.click();
  for (let i = 0; i < 3; i++) await dialog.getByRole("button", { name: "Далее", exact: true }).click();
  await dialog.getByRole("button", { name: "Завершить экскурсию" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "С чего начать", exact: true })).toBeVisible();
});

for (const [role, destination, action] of [
  ["employee", "my-lessons", "Открыть мои уроки"],
  ["department_head", "my-department", "Открыть мой отдел"],
  ["methodologist", "materials", "Открыть материалы"],
] as const) {
  test(`${role} sees their own route without HR setup links`, async ({ page }) => {
    await signIn(page, role);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: action, exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть структуру компании" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `../design-preview/implementation/start-${role}-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Перейти к работе", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${destination}$`));
  });
}
