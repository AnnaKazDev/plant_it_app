// risk: #4 — photo upload succeeds but the action teaser still shows a placeholder
// seed: tests/e2e/signin.spec.ts
// test-plan: context/foundation/test-plan.md Risk #4

import { test, expect } from "@playwright/test";
import { addWateringActionWithPhotosViaUi } from "./helpers/add-action";
import { createE2eUser, deleteE2eUser, type E2eUser } from "./helpers/auth-fixture";
import { createE2ePlant, type E2ePlant } from "./helpers/plant-fixture";
import { signInViaApi } from "./helpers/sign-in";

test.describe("Photo upload and teaser visibility (Risk #4)", () => {
  let user: E2eUser | undefined;
  let plant: E2ePlant | undefined;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required");
    }

    const nextUser = await createE2eUser("photo-teaser");
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

  test("uploaded photo appears in action teaser on plant card and plant list (Risk #4)", async ({ page }) => {
    if (!plant) {
      throw new Error("Test plant not initialized");
    }

    const actionNotes = `e2e-photo-action-${crypto.randomUUID().slice(0, 8)}`;

    // Open plant card and add a watering action with photo through the UI.
    await page.goto(`/plants/${plant.plantId}`);
    await expect(page.getByRole("heading", { name: plant.displayName, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await addWateringActionWithPhotosViaUi(page, actionNotes, ["test-plant.png"]);

    // Plant card read path: action shows in History with photo teaser (not placeholder).
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible({ timeout: 30_000 });

    // Find the action article by notes text
    const cardAction = page
      .getByRole("article")
      .filter({ has: page.getByText(actionNotes) })
      .first();
    await expect(cardAction).toBeVisible({ timeout: 30_000 });

    // Verify photo teaser is visible (img inside button with aria-label "Open photo gallery")
    const cardPhotoButton = cardAction.getByRole("button", { name: "Open photo gallery" });
    await expect(cardPhotoButton).toBeVisible({ timeout: 30_000 });
    const cardPhoto = cardPhotoButton.locator("img");
    await expect(cardPhoto).toBeVisible();
    await expect(cardPhoto).toHaveAttribute("src", /.+/); // Non-empty src

    // Plant list read path: last activity teaser shows the same photo.
    await page.goto("/plants");
    const plantRow = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: plant.displayName, level: 2 }),
    });
    await expect(plantRow.getByText("Last activity")).toBeVisible();

    // Find the action teaser in plant list
    const listAction = plantRow.getByRole("article").filter({ has: page.getByText(actionNotes) });
    await expect(listAction).toBeVisible({ timeout: 30_000 });

    // Verify photo teaser is visible in list (simple ActionTeaser without button)
    const listPhoto = listAction.locator("img").first();
    await expect(listPhoto).toBeVisible({ timeout: 30_000 });
    await expect(listPhoto).toHaveAttribute("src", /.+/); // Non-empty src (not placeholder)
  });
});
