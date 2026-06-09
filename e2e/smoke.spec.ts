import { test, expect } from "@playwright/test";

test.describe("Valtrix smoke", () => {
  test("marketing home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Valtrix/i);
    await expect(page.getByRole("link", { name: /valtrix/i }).first()).toBeVisible();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("admin grant page loads", async ({ page }) => {
    await page.goto("/admin/grant");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("support page loads in dashboard shell", async ({ page }) => {
    await page.goto("/dashboard/support");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
