// risk: #1 — user saves an action but it never appears on plant card or plant-list teaser
// seed: tests/e2e/signin.spec.ts
// test-plan: context/foundation/test-plan.md Risk #1

import { test, expect } from "@playwright/test";
import { addWateringActionWithNotesViaUi } from "./helpers/add-action";
import { createE2eUser, deleteE2eUser, type E2eUser } from "./helpers/auth-fixture";
import { createE2ePlant, type E2ePlant } from "./helpers/plant-fixture";
import { signInViaApi } from "./helpers/sign-in";

test.describe("Action create read-back (Risk #1)", () => {
  let user: E2eUser | undefined;
  let plant: E2ePlant | undefined;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required");
    }

    const nextUser = await createE2eUser("action-readback");
    const nextPlant = await createE2ePlant(nextUser.userId, "basil");
    await signInViaApi(page, baseURL, nextUser.email, nextUser.password);
    user = nextUser;
    plant = nextPlant;
  });

  test.afterEach(async () => {
    if (user) {
      await deleteE2eUser(user.userId);
    }
  });

  test("saved action appears on plant card and plant list teaser (Risk #1)", async ({ page }) => {
    if (!plant) {
      throw new Error("Test plant not initialized");
    }

    const actionNotes = `e2e-watering-notes-${crypto.randomUUID().slice(0, 8)}`;

    // Open plant card and add a watering action through the UI.
    await page.goto(`/plants/${plant.plantId}`);
    await expect(page.getByRole("heading", { name: plant.displayName, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await addWateringActionWithNotesViaUi(page, actionNotes);

    // Plant card read path: action shows in History after refresh.
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /watering/i, level: 3 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(actionNotes)).toBeVisible({ timeout: 30_000 });

    // Plant list read path: last activity teaser shows the same action.
    await page.goto("/plants");
    const plantRow = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: plant.displayName, level: 2 }),
    });
    await expect(plantRow.getByText("Last activity")).toBeVisible();
    await expect(plantRow.getByRole("heading", { name: /watering/i, level: 3 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(plantRow.getByText(actionNotes)).toBeVisible({ timeout: 30_000 });
  });
});
