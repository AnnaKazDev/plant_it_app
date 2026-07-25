// ═══════════════════════════════════════════════════════════════════════════
// SEED TEST — Reference E2E test demonstrating all conventions for this project
// ═══════════════════════════════════════════════════════════════════════════
//
// This test demonstrates all required E2E testing conventions:
//
// 1. SELECTORS: getByRole, getByLabel, getByText as defaults
//    (CSS selectors and XPath are forbidden)
//
// 2. WAITING: waitForState (toBeVisible, waitForURL, waitForResponse)
//    (page.waitForTimeout() is forbidden)
//
// 3. TEST DATA: Unique identifiers (UUID suffix) in every test
//    (prevents collisions in parallel runs)
//
// 4. CLEANUP: afterEach with deleteE2eUser() cascades cleanup
//    (plants, actions, photos via FK constraints)
//
// 5. NAMING: Test name contains (Risk #N) linking it to test-plan.md
//    (traceability for maintenance)
//
// 6. ISOLATION: Each test gets its own user/data via beforeEach
//    (tests can run in any order)
//
// 7. AUTH: signInViaApi() instead of UI login
//    (faster, we don't test login in every test)
//
// risk: #1 — user saves an action but it never appears on plant card or plant-list teaser
// test-plan: context/foundation/test-plan.md Risk #1
// ═══════════════════════════════════════════════════════════════════════════

import { test, expect } from "@playwright/test";
import { addWateringActionWithNotesViaUi } from "./helpers/add-action";
import { createE2eUser, deleteE2eUser, type E2eUser } from "./helpers/auth-fixture";
import { createE2ePlant, type E2ePlant } from "./helpers/plant-fixture";
import { signInViaApi } from "./helpers/sign-in";

test.describe("SEED: Action create read-back (Risk #1)", () => {
  // ───────────────────────────────────────────────────────────────────────
  // CONVENTION #4: CLEANUP — let variables for user/plant
  // ───────────────────────────────────────────────────────────────────────
  let user: E2eUser | undefined;
  let plant: E2ePlant | undefined;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required");
    }

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #3: UNIQUE IDENTIFIERS — UUID suffix in seed prefix
    // ─────────────────────────────────────────────────────────────────────
    const nextUser = await createE2eUser("seed-example");
    const nextPlant = await createE2ePlant(nextUser.userId, "basil");

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #7: AUTH — signInViaApi() instead of UI login
    // ─────────────────────────────────────────────────────────────────────
    await signInViaApi(page, baseURL, nextUser.email, nextUser.password);

    user = nextUser;
    plant = nextPlant;
  });

  test.afterEach(async () => {
    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #4: CLEANUP — deleteE2eUser() cascades cleanup
    // ─────────────────────────────────────────────────────────────────────
    if (user) {
      await deleteE2eUser(user.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // CONVENTION #5: NAMING — (Risk #1) links test to test-plan.md
  // ───────────────────────────────────────────────────────────────────────
  test("saved action appears on plant card and plant list teaser (Risk #1)", async ({ page }) => {
    if (!plant) {
      throw new Error("Test plant not initialized");
    }

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #3: UNIQUE IDENTIFIERS — UUID suffix prevents collisions
    // ─────────────────────────────────────────────────────────────────────
    const actionNotes = `e2e-watering-notes-${crypto.randomUUID().slice(0, 8)}`;

    // ═════════════════════════════════════════════════════════════════════
    // STEP 1: Add action through UI (simulate user flow)
    // ═════════════════════════════════════════════════════════════════════
    await page.goto(`/plants/${plant.plantId}`);

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #1: SELECTORS — getByRole with name and level (accessibility first)
    // CONVENTION #2: WAITING — toBeVisible() with timeout (wait for state)
    // ─────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: plant.displayName, level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    // ─────────────────────────────────────────────────────────────────────
    // Helper addWateringActionWithNotesViaUi() uses:
    // - getByLabel("Action") — form field selector
    // - getByLabel("Notes (optional)") — textarea selector
    // - getByRole("button", { name: "Add action" }) — button selector
    // - waitForResponse() — waits for POST /api/actions (not timeout!)
    // ─────────────────────────────────────────────────────────────────────
    await addWateringActionWithNotesViaUi(page, actionNotes);

    // ═════════════════════════════════════════════════════════════════════
    // STEP 2: Verify read path on plant card (same page)
    // ═════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #1: SELECTORS — getByRole("heading") with regex match
    // CONVENTION #2: WAITING — toBeVisible() waits for element to appear
    // ─────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /watering/i, level: 3 })).toBeVisible({
      timeout: 30_000,
    });

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #1: SELECTORS — getByText with exact text (our unique notes)
    // ─────────────────────────────────────────────────────────────────────
    await expect(page.getByText(actionNotes)).toBeVisible({ timeout: 30_000 });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 3: Verify read path on plant list (navigation)
    // ═════════════════════════════════════════════════════════════════════
    await page.goto("/plants");

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #1: SELECTORS — getByRole("article") with filter (semantic HTML)
    // Filter article by nested heading (no brittle CSS!)
    // ─────────────────────────────────────────────────────────────────────
    const plantRow = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: plant.displayName, level: 2 }),
    });

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #2: WAITING — toBeVisible() with timeout (not waitForTimeout!)
    // ─────────────────────────────────────────────────────────────────────
    await expect(plantRow.getByText("Last activity")).toBeVisible();
    await expect(plantRow.getByRole("heading", { name: /watering/i, level: 3 })).toBeVisible({
      timeout: 30_000,
    });

    // ─────────────────────────────────────────────────────────────────────
    // CONVENTION #3: UNIQUE IDENTIFIERS — verify our unique notes
    // Thanks to UUID suffix we know this is exactly the action we added
    // ─────────────────────────────────────────────────────────────────────
    await expect(plantRow.getByText(actionNotes)).toBeVisible({ timeout: 30_000 });

    // ═════════════════════════════════════════════════════════════════════
    // TEST COMPLETE — cleanup will run in afterEach
    // ═════════════════════════════════════════════════════════════════════
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVENTIONS SUMMARY (all demonstrated above)
// ═══════════════════════════════════════════════════════════════════════════
//
// ✓ SELECTORS: getByRole, getByLabel, getByText (accessibility-first)
// ✓ WAITING: toBeVisible(), waitForResponse() (state, not time)
// ✓ DATA: UUID suffix in every test (unique, collision-free)
// ✓ CLEANUP: afterEach + deleteE2eUser() (cascading cleanup)
// ✓ NAMING: (Risk #1) in test name (traceability)
// ✓ ISOLATION: beforeEach + own user/plant (any order)
// ✓ AUTH: signInViaApi() (fast, no UI login)
//
// This test is the REFERENCE — use it when writing new tests.
// ═══════════════════════════════════════════════════════════════════════════
