import { test, expect } from "@playwright/test";

test("public booking chooses a day before a slot and sends no CRM credentials", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("access_token", "private-crm-token"));
  const slots = [
    { starts_at: "2030-01-07T05:00:00Z", ends_at: "2030-01-07T05:30:00Z", duration_minutes: 30 },
    { starts_at: "2030-01-08T05:00:00Z", ends_at: "2030-01-08T05:30:00Z", duration_minutes: 30 },
  ];
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("public-calendar")) {
      expect(route.request().headers()["authorization"]).toBeUndefined();
      expect(route.request().headers()["x-support-session"]).toBeUndefined();
      if (path.endsWith("/book")) {
        expect(route.request().postDataJSON().visitor_name).toBe("Посетитель");
        return route.fulfill({ status: 201, json: { id: "receipt", ...slots[0] } });
      }
      return route.fulfill({ json: { slots } });
    }
    return route.fulfill({ status: 401, json: { detail: "not authenticated" } });
  });
  await page.goto("/book/test-token");
  await expect(page.getByRole("heading", { name: "Выберите удобное время" })).toBeVisible();
  await expect(page.getByLabel("Ваше имя")).not.toBeVisible();
  await page.locator(".booking-dates button").first().click();
  await page.locator(".slot-groups button").first().click();
  await page.getByLabel("Ваше имя").fill("Посетитель");
  await page.getByLabel("Электронная почта").fill("visitor@example.org");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../design-preview/implementation/calendar-public-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Подтвердить запись" }).click();
  await expect(page.getByText("ЗАПИСЬ ПОДТВЕРЖДЕНА")).toBeVisible();
  await expect(page).toHaveURL(/\/book\/test-token/);
});

test("approved calendar saves availability, reloads it and creates a real participant payload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  let state = { rules: [] as unknown[], blocks: [], public_link: null, timezone: "Asia/Yekaterinburg", buffer_minutes: 0 };
  let created = false;
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "Ольга", role: "hr", company_id: "company" };
    else if (path === "/api/v1/recruitment/availability") body = state;
    else if (path === "/api/v1/recruitment/availability/rules") { state = { ...state, ...request.postDataJSON() }; body = state; }
    else if (path === "/api/v1/recruitment/participants") body = [{ id: "existing-user", full_name: "Сотрудник CRM", email: "employee@example.org", role: "employee" }];
    else if (path === "/api/v1/recruitment/interviews/calendar") body = { meetings: [], free_slots: [], best_slot: null, day_load_percent: 0, week_load_percent: 0, week_slots_count: 3 };
    else if (path === "/api/v1/recruitment/interviews" && request.method() === "POST") {
      expect(request.postDataJSON().participant_ids).toEqual(["existing-user"]);
      expect(request.postDataJSON().starts_at).toMatch(/Z$/);
      created = true; body = { id: "meeting" };
    }
    await route.fulfill({ status: created && path.endsWith("/interviews") ? 201 : 200, json: body });
  });
  await page.goto("/dashboard/calendar");
  await page.getByRole("button", { name: "Доступность", exact: true }).click();
  await page.getByRole("switch", { name: "Доступность: Понедельник", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByText("Изменения сохранены", { exact: true })).toBeVisible();
  await page.screenshot({ path: `../design-preview/implementation/calendar-settings-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Закрыть", exact: true }).last().click();
  await page.reload();
  await page.getByRole("button", { name: "Доступность", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Доступность: Понедельник", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Закрыть", exact: true }).last().click();
  await page.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await page.getByRole("button", { name: "Сотрудник CRM" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Назначить встречу", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(created).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("unrelated edit preserves the second DST occurrence, duration and guest contact", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "Europe/Berlin", viewport: test.info().project.use.viewport });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("access_token", "test-fixture"));
  const meeting = { id: "dst", title: "DST meeting", starts_at: "2030-10-27T01:30:00Z", duration_minutes: 240, meeting_type: "work", candidate_id: null, candidate_name: null, participant_ids: [], participants: [], meeting_url: null, notes: null, external_name: "Guest", external_contact: "guest@example.org" };
  let changed = false;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", full_name: "Ольга", role: "hr", company_id: "company" };
    else if (path.endsWith("/interviews/calendar")) body = { meetings: [meeting], free_slots: [], best_slot: null, day_load_percent: 0, week_load_percent: 0 };
    else if (path.endsWith("/availability")) body = { rules: [], blocks: [], public_link: null, timezone: "Europe/Berlin", buffer_minutes: 0 };
    else if (path.endsWith("/interviews/dst")) {
      const data = route.request().postDataJSON();
      expect(data.starts_at).toBe(meeting.starts_at);
      expect(data.duration_minutes).toBe(240);
      changed = true; body = { ...meeting, ...data };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/dashboard/calendar");
  await page.getByLabel("Открыть день").fill("2030-10-27");
  await page.getByRole("button").filter({ hasText: "DST meeting" }).click();
  await expect(page.getByText("guest@example.org", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  await page.getByLabel("Название встречи").fill("New title");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(changed).toBeTruthy();
  await context.close();
});
