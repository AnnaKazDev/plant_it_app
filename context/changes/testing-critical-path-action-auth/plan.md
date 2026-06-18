# Critical-path action + auth integration — Implementation Plan

## Overview

Rollout Phase 1 of `context/foundation/test-plan.md`: add integration tests that prove action create persists and surfaces on plant card and list read paths (Risk #1), reject abusive input without orphan rows (Risk #6), and block cross-user access when authenticated (Risk #3). Sub-phases are ordered by **cost × signal** and risk priority; the test harness fix is bundled immediately before ownership tests because service-role bypass invalidates Risk #3 signal today.

## Current State Analysis

Vitest 4 integration tests exist for `POST /api/actions`, `GET/POST /api/plants`, `GET /api/plants/[id]`, and `POST /api/photos/upload`. They `fetch` a running dev server with `X-Test-User-Id` auth bypass. Seed data is inserted via service-role admin client (`src/lib/test-utils.ts`).

**Gaps confirmed by research:**

| Risk | Current coverage | Blocker |
|------|------------------|---------|
| #1 | POST 201 asserts only; list/card tests seed via admin, not POST | No create→read-back chain |
| #3 | Unauthenticated 401 only; cross-user upload test is `it.skip` | `createClient` uses service role when `X-Test-User-Id` present (`src/lib/supabase.ts:51-59`) |
| #6 | Partial Zod/MIME tests; constants copied from app code | No PRD-oracle boundaries; no rejection DB read-back |

**Production contracts to assert (not 403):** wrong-owner access returns **404** with `PLANT_NOT_FOUND` / `ACTION_NOT_FOUND`, or empty list — no `FORBIDDEN` in `ERROR_CODES` (`src/types.ts:65-82`).

**Surface semantics for Risk #1:** list `last_action` uses max `date` including planned (future); card "Last activity" excludes planned (`partitionActionsByPlanned` / `compareActionsByDateDesc`). Tests must assert the correct surface, not assume identical teasers.

## Desired End State

After all sub-phases:

1. A past/today `POST /api/actions` is followed by `GET /api/plants/[id]` and `GET /api/plants` read-back proving the new action appears with correct `id`, name, and date on both surfaces.
2. Invalid name length, date, and sixth photo return 4xx; direct DB counts prove no orphan `actions` or `photos` rows.
3. User B authenticated cannot read or mutate User A's plant, action, or photo — harness uses user-scoped Supabase session (RLS enforced).
4. `context/foundation/test-plan.md` §6.1, §6.2, §6.4, and §6.6 document the patterns this phase established.

**Verify locally:** `npx supabase start`, `npm run dev` (separate terminal), `npm run test:integration`.

### Key Discoveries

- Write path: `src/pages/api/actions/index.ts`; read paths: `fetchPlantListForUser` / `GET /api/plants`, `loadPlantCardPageData` / `GET /api/plants/[id]` with `compareActionsByDateDesc` (`src/lib/action-dates.ts`).
- `seedTestData()` already returns `email` + `password` — usable for real session minting (`src/lib/test-utils.ts:109-110`).
- Photo max-5 is API-only; sixth upload must assert DB count stays at 5 (`src/pages/api/photos/upload.ts:112-142`).
- Nonexistent `action_type_id` may return 500 (FK), not 400 — out of scope for Risk #6 (document in §6, do not add failing test).

## What We're NOT Doing

- CI wiring for integration tests (Rollout Phase 3).
- Weather mocking or photo-teaser read paths (Rollout Phase 2).
- E2E / Playwright.
- Marketing page tests (test-plan §7).
- Dedicated full suite for `PATCH`/`DELETE` action happy paths — only cross-user rejection on `PATCH` and `DELETE` for Risk #3.
- Fixing production behavior for FK violations on bad `action_type_id`.

## Implementation Approach

Five sub-phases, cheapest high-signal work first; harness change gates only Risk #3:

| Order | Sub-phase | Risks | Rationale |
|-------|-----------|-------|-----------|
| 1 | Action create → read-back | #1 | Highest impact×likelihood; no harness change; reuses existing `X-Test-User-Id` |
| 2 | Validation rejection + DB oracle | #6 | Cheap API contract tests; independent PRD constants |
| 3 | User-scoped test harness | #3 (enabler) | Required before any RLS assertion; bundled immediately before ownership tests |
| 4 | Two-user ownership boundaries | #3 | Highest cost; depends on sub-phase 3 |
| 5 | Cookbook §6 patterns | cross-cutting | Captures patterns after code exists |

Existing happy-path tests may keep `X-Test-User-Id` after harness fix if the fixed path still supports it with RLS — or migrate to session headers from `signInTestUser()`. Ownership tests **must** use user-scoped sessions only.

## Critical Implementation Details

**Harness contract:** When `X-Test-User-Id` is used in non-production, `createClient` must return an **anon-key client with that user's JWT session** (RLS active), not `createTestClient(true)`. Mint session via `signInWithPassword` in test-utils (credentials from `seedTestData` / `seedTwoUsers`). Middleware may continue resolving `context.locals.user` via admin `getUserById` for the header bypass — only the Supabase client in API handlers must be user-scoped.

**PRD oracle constants** — define once per test file, do not import from app Zod:

```ts
const PRD_MAX_ACTION_NAME = 300;
const PRD_MAX_NOTES = 1000;
const PRD_MAX_PHOTOS_PER_ACTION = 5;
const PRD_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
```

**Rejection read-back:** after 4xx, query via service-role admin client: `SELECT count(*) FROM actions WHERE plant_id = ?` or `FROM photos WHERE action_id = ?` — expect zero new rows vs pre-request baseline.

---

## Phase 1: Action create → read-back (Risk #1)

### Overview

Prove POST persists and surfaces on both plant card and list teaser read paths for the owning user. Challenge "201 means read path works."

### Changes Required:

#### 1. Critical-path integration scenarios

**File:** `src/pages/api/actions/index.test.ts` (extend) or new `src/pages/api/actions/critical-path.test.ts`

**Intent:** Add scenarios that POST then GET — not POST-only asserts. Prefer a dedicated `critical-path.test.ts` if the actions index file is already long; keep one `describe` per risk area for clarity.

**Contract:**

- Scenario A (past/today date): `POST /api/actions` with `date` ≤ today → `GET /api/plants/[id]` → response `plant.actions` contains new `id`, matching `custom_action_name` or action type display, and `date`.
- Scenario B: same POST → `GET /api/plants` → `plants` entry for `plant_id` has `last_action.id` equal to created action `id`.
- Scenario C (future date): POST with future `date` → card GET shows action in actions array; assert it is **not** treated as "last completed" on card if response exposes planned vs history split (or document via `date` comparison against today). List `last_action` **should** match future action (highest date).
- Use empty or minimal plant fixture: create plant via `POST /api/plants` or seed plant with **no** pre-existing actions so read-back isolation is clear.
- Read-back asserts use response JSON only (same as production client); optional admin count is supplementary, not the primary oracle.

#### 2. Align list test with POST-origin data (optional cleanup)

**File:** `src/pages/api/plants/index.test.ts`

**Intent:** If existing `last_action` tests only admin-seed actions, add a comment cross-referencing critical-path tests as the POST-origin source of truth — avoid duplicating full scenario unless a regression gap remains.

**Contract:** No behavioral change required if critical-path file covers POST → `GET /api/plants`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes including new Risk #1 scenarios
- `npm run lint` passes
- `npm run check` passes

#### Manual Verification:

- Skim test output: scenarios name surfaces explicitly (card vs list vs planned)

**Implementation Note:** Pause for human confirmation of manual criteria before Phase 2.

---

## Phase 2: Validation rejection + DB oracle (Risk #6)

### Overview

Prove server rejects abusive action/photo input with 4xx and leaves no orphan DB rows. Use PRD-named constants as oracle — do not import Zod limits from production code.

### Changes Required:

#### 1. Action name and date boundaries

**File:** `src/pages/api/actions/index.test.ts` or `src/pages/api/actions/validation.test.ts`

**Intent:** Add boundary pairs and invalid date cases with rejection read-back.

**Contract:**

- `custom_action_name` length 300 → 201; 301 → 400 `VALIDATION_ERROR`; count `actions` for plant unchanged after 400.
- `additional_data` length 1000 → 201; 1001 → 400; count unchanged after 400.
- Invalid `date` strings (`"not-a-date"`, `""` if rejected) → 400; count unchanged.
- Whitespace-only `custom_action_name` when used as sole identity → 400 (XOR with `action_type_id`).
- Do **not** add test expecting 400 for nonexistent `action_type_id` (FK → 500).

#### 2. Photo count and file rejection read-back

**File:** `src/pages/api/photos/upload.test.ts`

**Intent:** Extend existing upload tests with PRD oracle constants and DB count after rejection.

**Contract:**

- After 5 successful uploads, 6th → 400 `MAX_PHOTOS_EXCEEDED`; `photos` count for `action_id` remains 5 (admin query).
- Oversized file → 413 `FILE_TOO_LARGE`; photo count unchanged.
- Invalid MIME → 400 `INVALID_FILE_TYPE`; photo count unchanged.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes all Risk #6 scenarios
- `npm run lint` and `npm run check` pass

#### Manual Verification:

- Confirm test files define PRD constants locally (no imports from `index.ts` schemas or `photo-validation.ts`)

**Implementation Note:** Pause for human confirmation before Phase 3.

---

## Phase 3: User-scoped test harness (Risk #3 enabler)

### Overview

Fix test auth so integration tests exercise RLS like production. Bundle this immediately before ownership tests.

### Changes Required:

#### 1. Session minting helpers

**File:** `src/lib/test-utils.ts`

**Intent:** Add helpers for real user sessions and two-user fixtures.

**Contract:**

- `signInTestUser(email, password)` → returns `Headers` or header record suitable for `fetch` (session cookies and/or `Authorization: Bearer <access_token>`).
- `seedTwoUsers()` → `{ userA, userB }` each with `userId`, `plantId`, `actionId`, `email`, `password`; isolated plants/actions; document cleanup order in tests.
- `getRowCounts(admin, { plantId?, actionId? })` → optional helper for `{ actions, photos }` counts used by Phase 2 patterns.
- `cleanupTestData` unchanged (service role for teardown).

#### 2. Stop service-role bypass in API client

**File:** `src/lib/supabase.ts`

**Intent:** When `X-Test-User-Id` is present in non-production, use anon key + user JWT session instead of `createTestClient(true)`.

**Contract:**

- RLS policies in `supabase/migrations/20260604120000_core_data_schema.sql` apply to all integration requests using the fixed client.
- Existing tests using only `X-Test-User-Id` still pass for owner happy paths (may need session minting wired in `beforeAll` if JWT is required per request).
- Production and cookie-based auth paths unchanged.

#### 3. Harness smoke test

**File:** `src/lib/test-utils.harness.test.ts` (new, small)

**Intent:** Prove harness enforces RLS before Phase 4's full matrix — un-skip pattern from `upload.test.ts:212-248` as one case.

**Contract:**

- User B cannot upload to User A's `action_id` → 404 `ACTION_NOT_FOUND` when using `signInTestUser` headers (not `X-Test-User-Id` alone with service role).

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes; previously skipped cross-user upload scenario passes or is superseded by harness smoke test
- All pre-existing integration tests still pass (owner paths)
- `npm run lint` and `npm run check` pass

#### Manual Verification:

- Confirm `createClient` no longer calls `createTestClient(true)` for `X-Test-User-Id` in `src/lib/supabase.ts`

**Implementation Note:** Pause for human confirmation before Phase 4.

---

## Phase 4: Two-user ownership boundaries (Risk #3)

### Overview

Prove authenticated User B cannot read or mutate User A's plant, action, or photo. Assert 404 / empty list — not 401-only, not 403.

### Changes Required:

#### 1. Cross-user API matrix

**File:** `src/pages/api/ownership.test.ts` (new, shared) or extend per-route test files

**Intent:** Centralize two-user scenarios using `seedTwoUsers()` + `signInTestUser()`.

**Contract:**

| Actor | Request | Expected |
|-------|---------|----------|
| B | `GET /api/plants/{A.plantId}` | 404 `PLANT_NOT_FOUND` |
| B | `DELETE /api/plants/{A.plantId}` | 404 `PLANT_NOT_FOUND`; A's plant still exists (A can GET) |
| B | `POST /api/actions` body `{ plant_id: A.plantId, ... }` | 404 `PLANT_NOT_FOUND` |
| B | `PATCH /api/actions/{A.actionId}` | 404 `ACTION_NOT_FOUND` |
| B | `DELETE /api/actions/{A.actionId}` | 404 `ACTION_NOT_FOUND` |
| B | `POST /api/photos/upload` with A's `action_id` | 404 `ACTION_NOT_FOUND` |
| B | `GET /api/plants` | Empty array or only B's plants — never A's `plantId` |

- Use `signInTestUser` headers for B (and A for post-checks). Do not use service-role client for assertions except admin verification/counts.
- Un-skip and update `src/pages/api/photos/upload.test.ts` cross-user case to use new harness (or remove duplicate if `ownership.test.ts` covers it).

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes full ownership matrix
- `npm run lint` and `npm run check` pass

#### Manual Verification:

- None required beyond automated matrix

**Implementation Note:** Pause for human confirmation before Phase 5.

---

## Phase 5: Cookbook §6 patterns

### Overview

Document repeatable patterns in the test plan cookbook after implementation proves them.

### Changes Required:

#### 1. Update test-plan cookbook

**File:** `context/foundation/test-plan.md`

**Intent:** Replace §6.1, §6.2, §6.4 TBD placeholders; add §6.6 phase note.

**Contract:**

- **§6.1 (unit):** Note this project defers unit tests for API contracts until logic is extracted from route handlers; point to integration patterns.
- **§6.2 (integration):** Document prerequisites (`supabase start`, `dev` server), `fetch` + `API_URL`, `seedTestData` / `seedTwoUsers`, `signInTestUser`, POST→GET read-back pattern for Risk #1.
- **§6.4 (new API endpoint):** Template for ownership row (404 not 403) + validation rejection with PRD constants + DB count read-back.
- **§6.6:** Entry for Phase 1 completion date, change folder link, risks closed #1/#3/#6.
- Update §3 Phase 1 status to `implemented` when Progress complete (orchestrator convention).

#### 2. Change metadata

**File:** `context/changes/testing-critical-path-action-auth/change.md`

**Intent:** Set `status: implemented` when all Progress checkboxes are `[x]`.

**Contract:** Frontmatter `updated` date reflects completion.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` still passes (no code regressions from doc-only phase)

#### Manual Verification:

- Reader can add a new integration test using §6.2 + §6.4 without reading research.md

**Implementation Note:** Final phase — marks rollout Phase 1 complete.

---

## Testing Strategy

### Integration Tests (primary)

| File | Risks | Pattern |
|------|-------|---------|
| `critical-path.test.ts` or extended actions tests | #1 | POST → GET card + GET list |
| `validation.test.ts` or extended actions/upload tests | #6 | PRD constants, 4xx, admin count |
| `test-utils.harness.test.ts` | #3 | RLS smoke |
| `ownership.test.ts` | #3 | Two-user matrix |

### Manual Testing Steps

1. Run full suite with fresh Supabase: `npx supabase db reset` optional, then `supabase start`, `npm run dev`, `npm run test:integration`.
2. Intentionally break `createClient` service-role branch — confirm ownership tests fail (sanity check harness signal).

## Performance Considerations

Integration tests hit HTTP + DB; two-user matrix is sequential. Keep fixtures minimal (one plant/action per user). No parallel vitest workers against shared local Supabase unless file isolation is verified — default `vitest run` is acceptable.

## Migration Notes

No schema migrations. Harness change is test-runtime only; production auth unchanged.

## References

- Research: `context/changes/testing-critical-path-action-auth/research.md`
- Test plan: `context/foundation/test-plan.md` §2–§3, §6
- Action create: `src/pages/api/actions/index.ts`
- List loader: `src/lib/plant-page.ts:133-201`
- Card loader: `src/lib/plant-page.ts:364-453`
- RLS: `supabase/migrations/20260604120000_core_data_schema.sql:82-132`
- Harness bypass (to fix): `src/lib/supabase.ts:51-59`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Action create → read-back (Risk #1)

#### Automated

- [x] 1.1 `npm run test:integration` passes including Risk #1 POST→GET scenarios — b7fd240
- [x] 1.2 `npm run lint` passes — b7fd240
- [x] 1.3 `npm run check` passes — b7fd240

#### Manual

- [x] 1.4 Test names document card vs list vs planned semantics — b7fd240

### Phase 2: Validation rejection + DB oracle (Risk #6)

#### Automated

- [x] 2.1 `npm run test:integration` passes Risk #6 boundary and read-back scenarios
- [x] 2.2 `npm run lint` passes
- [x] 2.3 `npm run check` passes

#### Manual

- [x] 2.4 PRD constants are local to test files (no app imports)

### Phase 3: User-scoped test harness (Risk #3 enabler)

#### Automated

- [ ] 3.1 `npm run test:integration` passes harness smoke and all pre-existing owner tests
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run check` passes

#### Manual

- [ ] 3.4 `createClient` no longer uses service role for `X-Test-User-Id`

### Phase 4: Two-user ownership boundaries (Risk #3)

#### Automated

- [ ] 4.1 `npm run test:integration` passes ownership matrix
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run check` passes

### Phase 5: Cookbook §6 patterns

#### Automated

- [ ] 5.1 `npm run test:integration` passes (regression guard)

#### Manual

- [ ] 5.2 `context/foundation/test-plan.md` §6.1, §6.2, §6.4, §6.6 updated
- [ ] 5.3 `change.md` status set to `implemented`
