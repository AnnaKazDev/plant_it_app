// risk: auth — signed-in user reaches the app with session cookies set
// seed: tests/e2e/signin.spec.ts (first E2E exemplar for this project)

import { test, expect } from "@playwright/test";
import { createE2eUser, deleteE2eUser, type E2eUser } from "./helpers/auth-fixture";
import { signInViaUi } from "./helpers/sign-in";

test.describe("Sign in", () => {
  let user: E2eUser;

  test.beforeEach(async () => {
    user = await createE2eUser("signin");
  });

  test.afterEach(async () => {
    await deleteE2eUser(user.userId);
  });

  test("existing user can sign in and sees authenticated navigation", async ({ page }) => {
    // User is created via Supabase admin API (confirmed email + garden profile).
    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    await signInViaUi(page, user.email, user.password);

    await page.waitForURL("/");
    await expect(page.getByRole("link", { name: /My plants/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).not.toBeVisible();
  });
});
