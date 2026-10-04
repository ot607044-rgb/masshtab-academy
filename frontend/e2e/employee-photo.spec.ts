import { test, expect } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEUlEQVR4nGP8z4AATEhsPBwAM9EBBzDn4UwAAAAASUVORK5CYII=", "base64");
test("profile supports uploading replacing and removing employee photo", async ({ page }) => {
  let photo: string | null = null;
  await page.addInitScript(() => localStorage.setItem("access_token", "fixture"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/employees/e1/photo" && route.request().method() === "GET") return route.fulfill({ body: png, contentType: "image/png" });
    if (path === "/api/v1/employees/e1/photo") {
      photo = route.request().method() === "DELETE" ? null : `/api/v1/employees/e1/photo?v=${Date.now()}`;
      return route.fulfill({ json: { id: "e1", photo_url: photo } });
    }
    let body: unknown = [];
    if (path === "/api/v1/auth/me") body = { id: "u1", role: "hr", company_id: "company", full_name: "HR" };
    else if (path.includes("unread-count")) body = { count: 0 };
    else if (path === "/api/v1/workspace/employees/e1") body = { employee: { id: "e1", full_name: "Иван Иванов", company_id: "company", status: "active", photo_url: photo }, lessons_total: 0, lessons_completed: 0, completion_percent: 0, knowledge_percent: null, weak_areas: [], overdue_count: 0, roadmap: [], diagnostics: [], recruitment_history: [] };
    await route.fulfill({ json: body });
  });
  await page.goto("/dashboard/employees/e1");
  await page.getByRole("tab", { name: "Профиль", exact: true }).click();
  const input = page.getByLabel("Загрузить фото сотрудника", { exact: true });
  await expect(input).toBeAttached({ timeout: 2500 });
  await input.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Фото Иван Иванов", exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Профиль", exact: true }).click();
  await expect(page.getByRole("img", { name: "Фото Иван Иванов", exact: true }).first()).toBeVisible();
  await input.setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Удалить фото", exact: true })).toBeEnabled();
  await page.screenshot({ path: `../design-preview/implementation/employee-photo-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Удалить фото", exact: true }).click();
  await expect(page.getByRole("img", { name: "Фото Иван Иванов", exact: true })).toHaveCount(0);
  await page.route("**/api/v1/employees/e1/photo", route => route.fulfill({ status: 400, json: { detail: "Файл не является изображением" } }));
  await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("bad") });
  await expect(page.getByRole("alert")).toContainText("Файл не является изображением");
});
