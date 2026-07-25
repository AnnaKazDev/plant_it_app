import { expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WATERING_OPTION_LABEL = "💧 watering";

/** AddActionForm is a React island (`client:only`) — wait for hydration before interacting. */
export async function waitForAddActionForm(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Add action" })).toBeVisible({ timeout: 30_000 });
  const actionSelect = page.getByLabel("Action");
  await expect(actionSelect.locator("option", { hasText: "watering" })).toHaveCount(1, {
    timeout: 30_000,
  });
}

export async function addWateringActionWithNotesViaUi(page: Page, notes: string): Promise<void> {
  await waitForAddActionForm(page);
  const actionSelect = page.getByLabel("Action");
  await actionSelect.selectOption({ label: WATERING_OPTION_LABEL });
  await page.getByLabel("Notes (optional)").fill(notes);

  const createAction = page.waitForResponse(
    (response) => response.url().includes("/api/actions") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add action" }).click();
  const response = await createAction;
  expect(response.ok()).toBeTruthy();
}

/**
 * Add a watering action with photo(s) through the UI.
 * @param page - Playwright page object
 * @param notes - Optional notes for the action
 * @param photoFilenames - Array of filenames from tests/e2e/fixtures/ directory
 */
export async function addWateringActionWithPhotosViaUi(
  page: Page,
  notes: string,
  photoFilenames: string[],
): Promise<void> {
  await waitForAddActionForm(page);
  const actionSelect = page.getByLabel("Action");
  await actionSelect.selectOption({ label: WATERING_OPTION_LABEL });
  await page.getByLabel("Notes (optional)").fill(notes);

  // Upload photos
  const fileInput = page.getByLabel(/Photos \(optional, max \d+\)/);
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const filePaths = photoFilenames.map((filename) => path.join(fixturesDir, filename));

  // Verify files exist
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test fixture not found: ${filePath}`);
    }
  }

  await fileInput.setInputFiles(filePaths);

  // Wait for both action creation and photo upload(s)
  const createAction = page.waitForResponse(
    (response) => response.url().includes("/api/actions") && response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Add action" }).click();
  const actionResponse = await createAction;
  expect(actionResponse.ok()).toBeTruthy();

  // Wait for photo upload(s) to complete (one request per photo)
  const uploadPromises = photoFilenames.map(() =>
    page.waitForResponse(
      (response) => response.url().includes("/api/photos/upload") && response.request().method() === "POST",
      { timeout: 30_000 },
    ),
  );

  const uploadResponses = await Promise.all(uploadPromises);
  for (const response of uploadResponses) {
    expect(response.ok()).toBeTruthy();
  }
}
