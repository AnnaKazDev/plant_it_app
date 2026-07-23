import { test as setup, expect } from "@playwright/test";
import path from "path";
import { ensureE2eSetupUser } from "./helpers/auth-fixture";
import { signInViaApi } from "./helpers/sign-in";

const authFile = path.join("playwright", ".auth", "user.json");

setup("authenticate and save storageState", async ({ page, baseURL }) => {
  const user = await ensureE2eSetupUser();

  await signInViaApi(page, baseURL!, user.email, user.password);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /My plants/ })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
