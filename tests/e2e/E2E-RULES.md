# E2E Testing Rules

- Use `getByRole`, `getByLabel`, `getByText` as primary locators.
  Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., UUID suffix) for test data
  to avoid collisions in parallel runs. Clean up in `afterEach`.
- Use `signInViaApi` + `storageState` for authentication — never log in through UI
  in tests that exercise flows other than sign-in itself.
- **Test names must link to risks:** Include `(Risk #N)` in test name to bind it to
  `context/foundation/test-plan.md`. Example: `test('saved action appears on plant
  card and plant list teaser (Risk #1)', ...)` not `test('test 1', ...)`.
- **Photo uploads:** Place test fixtures in `tests/e2e/fixtures/`. Use
  `addWateringActionWithPhotosViaUi()` helper which waits for both action creation
  and all photo upload responses. Verify photo teasers via
  `getByRole("button", { name: "Open photo gallery" })` — not placeholder presence.

**Seed exemplar:** `tests/e2e/seed.spec.ts` — **READ THIS FIRST!**
Reference test demonstrating all E2E conventions: selectors, waiting,
unique IDs, cleanup, naming. Extensively commented as educational material.

**Other reference tests:**
- `tests/e2e/signin.spec.ts` (auth flow, UI login pattern)
- `tests/e2e/action-create-readback.spec.ts` (Risk #1 — action create + read-back)
- `tests/e2e/action-photo-teaser.spec.ts` (Risk #4 — photo upload + teaser visibility)
