import { expect, type Page } from "@playwright/test";

/** SignInForm is a React island (`client:only`) — wait for hydration before interacting. */
export async function waitForSignInForm(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 30_000 });
}

export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
  await waitForSignInForm(page);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Authenticate via the real sign-in API (sets Supabase SSR cookies on the browser context).
 * Use in auth.setup — not in tests that exercise the sign-in form UI.
 */
export async function signInViaApi(page: Page, baseURL: string, email: string, password: string): Promise<void> {
  const response = await page.request.post(`${baseURL}/api/auth/signin`, {
    form: { email, password },
    headers: { Origin: baseURL },
  });

  if (!response.ok()) {
    throw new Error(`Sign-in API failed with status ${response.status()}`);
  }
}
