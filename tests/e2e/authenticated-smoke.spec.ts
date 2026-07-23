// Demonstrates storageState injection — no UI login in this test.

import { test, expect } from "@playwright/test";

test("storageState user can open a protected route", async ({ page }) => {
  await page.goto("/plants");
  await expect(page).not.toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole("link", { name: /My plants/ })).toBeVisible();
});
