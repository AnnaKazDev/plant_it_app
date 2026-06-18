---
date: 2026-06-18T12:00:00+02:00
researcher: Cursor Agent
git_commit: 48a182f0f4b8b938a93fe3f979959e32a1191e0c
branch: test_plans
repository: plant_it_app
topic: "Rollout Phase 1 — Critical-path action + auth integration (Risks #1, #3, #6)"
tags: [research, integration-tests, actions, rls, validation, vitest]
status: complete
last_updated: 2026-06-18
last_updated_by: Cursor Agent
---

# Research: Rollout Phase 1 — Critical-path action + auth integration

**Date**: 2026-06-18
**Researcher**: Cursor Agent
**Git Commit**: `48a182f0f4b8b938a93fe3f979959e32a1191e0c`
**Branch**: `test_plans`
**Repository**: plant_it_app

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md`.

**Risks to verify:** #1 (action saved but missing from card/list teaser), #3 (cross-user data access / RLS), #6 (invalid action input accepted server-side).

**Risk response guidance to verify, not blindly accept:**
- **#1:** After POST action, plant card and list teaser both show the new action for the owning user; challenge "201 means read path works"; avoid happy-path-only POST without DB read-back.
- **#3:** User A cannot read/mutate User B's plant, action, or photo when authenticated; challenge "login implies ownership"; avoid testing only unauthenticated 401.
- **#6:** Oversized name, bad dates, >5 photos rejected with 4xx; challenge client-only validation; avoid mirroring zod as oracle.

**Hot-spot directories (likelihood evidence — NOT anchors):** `src/lib`, `src/components/plants`, `src/pages/api/photos`.

**Stack:** Vitest 4.1 (Node), local Supabase forced in `test-setup.ts`, HTTP `fetch` to running dev server (`API_URL` default `http://localhost:4321`), `X-Test-User-Id` auth bypass in dev.

## Summary

Phase 1 risks are real and largely **untested as end-to-end integration scenarios**. The write path (`POST /api/actions`) and read paths (`GET /api/plants`, `GET /api/plants/[id]`, `fetchPlantListForUser`, `loadPlantCardPageData`) are implemented and connected, but **no test verifies create-then-read across list + card** — the core Risk #1 gap.

RLS policies on `plants`, `actions`, and `photos` are comprehensive in migrations, but the **test harness bypasses RLS** (`X-Test-User-Id` → service-role Supabase client). The only cross-user test is `it.skip` in `upload.test.ts`. Risk #3 cannot be proven until the harness uses user-scoped sessions (anon key + JWT or sign-in cookies). Production returns **404** (not 403) for wrong-owner access — tests should assert `PLANT_NOT_FOUND` / `ACTION_NOT_FOUND` / empty lists, not `FORBIDDEN`.

Server-side validation exists (Zod on actions, `validatePhotoFile` on uploads) with partial test coverage. Gaps: 300-char name boundary, invalid dates, rejection read-back (no orphan rows), nonexistent `action_type_id` (likely 500 not 400). Max-5 photos is API-only with no DB constraint.

**Cheapest useful layer confirmed:** integration (API + DB read-back). **Blocker for Risk #3:** fix test auth to enforce RLS before adding two-user scenarios.

## Detailed Findings

### Risk #1 — Action create → card / list teaser read paths

#### Write path

| Item | Location |
|------|----------|
| POST handler | `src/pages/api/actions/index.ts:41-122` |
| Zod schema | `src/pages/api/actions/index.ts:12-31` |
| Plant guard (RLS) | `src/pages/api/actions/index.ts:72-76` → 404 if plant invisible |
| Insert | `src/pages/api/actions/index.ts:91-102` |
| Client submit | `src/components/plants/AddActionForm.tsx:110-144` → `onActionAdded()` triggers card refresh |

#### Plant card read path

| Path | Entry | Sort / partition |
|------|-------|----------------|
| SSR | `src/pages/plants/[id].astro` → `loadPlantCardPageData()` (`src/lib/plant-page.ts:364-453`) | `compareActionsByDateDesc` (`src/lib/action-dates.ts:18-20`) |
| Client refresh | `PlantCardContent.refreshPlant()` → `fetchPlantCardClient()` (`src/lib/plant-card-client.ts:59-60`) → `GET /api/plants/[id]` (`src/pages/api/plants/[id].ts:25-122`) | Same sort; `partitionActionsByPlanned()` (`src/lib/plant-card-client.ts:69-74`) |

Card UI splits actions:
- **Last activity** (`history.at(0)`) — past/today only (`PlantCardContent.tsx:34-35, 87-92`)
- **Upcoming** — future-dated (`PlantCardContent.tsx:101-109`)
- **History** — completed actions (`PlantCardContent.tsx:112-120`)

#### List teaser read path

| Step | Location |
|------|----------|
| Loader | `fetchPlantListForUser()` (`src/lib/plant-page.ts:133-201`) |
| API | `GET /api/plants` (`src/pages/api/plants/index.ts:26-38`) |
| `last_action` | Separate actions query, `compareActionsByDateDesc`, take `[0]` (`plant-page.ts:145-185`) |
| UI | `PlantListItem` → `ActionTeaser` (`src/components/plants/PlantListItem.tsx:44-45`) |

**Ordering:** all surfaces use **`date` field**, not `created_at`. List `last_action` includes **planned (future-dated)** actions; card "Last activity" excludes them.

**Product nuance:** A future-dated save can look "missing" on the card if the user expects it under History — it appears under Upcoming. On the list teaser it will show (highest `date`).

#### Existing tests (gaps)

| File | Covers | Does NOT cover |
|------|--------|----------------|
| `src/pages/api/actions/index.test.ts` | POST validation, 201 shapes, 401 | POST → GET list/card read-back |
| `src/pages/api/plants/[id].test.ts` | GET sorted actions; `additional_data` round-trip | POST→GET for new action on empty plant; planned vs history |
| `src/pages/api/plants/index.test.ts` | `last_action`, `planned_action_count`, sort | Seeds via admin insert, not POST `/api/actions` |

**Verified response guidance:**
- ✓ Must challenge "201 means read path works" — **confirmed gap**
- ✓ Anti-pattern "happy-path-only POST" — **current state matches anti-pattern**
- ✓ Cheapest layer: integration with DB read-back — **confirmed**

**Recommended test scenarios:**
1. `POST /api/actions` (past/today date) → `GET /api/plants/[id]` → assert action `id` in `plant.actions`
2. Same POST → `GET /api/plants` → assert `last_action.id` matches
3. Future-dated POST → card GET shows action; document planned vs history partition explicitly

---

### Risk #3 — Cross-user access / RLS

#### Auth model

| Layer | Behavior | Location |
|-------|----------|----------|
| Middleware | Login only; `context.locals.user` from cookies or `X-Test-User-Id` | `src/middleware.ts:6-46` |
| Test bypass | `X-Test-User-Id` → admin `getUserById` → sets user | `src/middleware.ts:9-23` |
| Supabase client | **Service role when `X-Test-User-Id` present (non-prod)** — **RLS bypassed** | `src/lib/supabase.ts:51-59` |
| API routes | No explicit `user_id` on by-ID routes; RLS gates access | e.g. `src/pages/api/plants/[id].ts:40-77` |

**Wrong-owner contract:** 404 with `PLANT_NOT_FOUND` / `ACTION_NOT_FOUND`, not 403. No `FORBIDDEN` in `ERROR_CODES` (`src/types.ts:65-82`).

#### RLS policies (migrations)

| Table | Rule | Location |
|-------|------|----------|
| `plants` | `auth.uid() = user_id` (all ops) | `supabase/migrations/20260604120000_core_data_schema.sql:82-85` |
| `actions` | EXISTS plant owned by `auth.uid()` | same file `:91-102` |
| `photos` | EXISTS action → plant owned by `auth.uid()` | same file `:105-132` |
| Storage `plant-photos` | First path segment = `auth.uid()` | `supabase/migrations/20260604180000_photo_storage_setup.sql:20-53` |

Storage policies do **not** verify `action_id` in path belongs to user — DB `photos` insert still RLS-protected; orphan storage objects possible.

#### Explicit ownership at query layer

- `fetchPlantListForUser`: `.eq("user_id", userId)` (`src/lib/plant-page.ts:133-137`)
- `POST /api/plants`: sets `user_id: context.locals.user.id` (`src/pages/api/plants/index.ts:150-158`)

#### Existing cross-user tests

| Scenario | Status |
|----------|--------|
| User B upload to User A's action | `it.skip` — documents service-role bypass (`src/pages/api/photos/upload.test.ts:212-248`) |
| User B GET/DELETE plant, POST action on A's plant, PATCH/DELETE action | **None** |
| Unauthenticated 401 | Covered in all API test suites |

**Verified response guidance:**
- ✓ Must challenge "login implies ownership" — **confirmed gap; harness invalidates RLS tests**
- ✓ Anti-pattern "only 401" — **confirmed**
- ⚠ Correction: test plan mentions "403/empty"; production uses **404/empty** — plan wording should not require 403

**Blocker for Phase 1 Risk #3 tests:** Extend harness so `X-Test-User-Id` uses **anon key + user JWT** (or real sign-in cookies via `/api/auth/signin`). `seedTestData()` already returns `email` + `password` (`src/lib/test-utils.ts:109-110`) — usable for cookie auth.

**Recommended test scenarios (after harness fix):**
1. `seedTwoUsers()` fixture in `test-utils.ts`
2. User B `GET /api/plants/[id]` for A's plant → 404 `PLANT_NOT_FOUND`
3. User B `POST /api/actions` with A's `plant_id` → 404
4. User B `POST /api/photos/upload` with A's `action_id` → 404 (un-skip existing test)
5. User B `GET /api/plants` → empty or only B's plants
6. User B `DELETE /api/plants/[id]` for A's plant → 404

---

### Risk #6 — Invalid / abusive action input

#### Limits (canonical)

| Field | Limit | Enforced at |
|-------|-------|-------------|
| `custom_action_name` | 1–300 chars | Zod (`src/pages/api/actions/index.ts:16`) + DB CHECK (`core_data_schema.sql:40`) |
| `additional_data` | max 1000 chars | Zod only |
| `date` | `Date.parse` not NaN | Zod only — permissive |
| Action identity | XOR `action_type_id` / `custom_action_name` | Zod + DB `action_name_check` |
| Photos per action | max 5 | API count only (`src/pages/api/photos/upload.ts:11-16, 112-142`) |
| Photo MIME | JPEG/PNG/WebP | `src/lib/photo-validation.ts:1-22` |
| Photo size | 10 MB | `photo-validation.ts` + storage bucket |

#### 4xx rejection paths

**Actions:** 400 `VALIDATION_ERROR` (Zod), 404 `PLANT_NOT_FOUND`, 401 `UNAUTHORIZED` (`src/pages/api/actions/index.ts`).

**Photos:** 400 `VALIDATION_ERROR` / `INVALID_FILE_TYPE` / `MAX_PHOTOS_EXCEEDED`, **413** `FILE_TOO_LARGE`, 404 `ACTION_NOT_FOUND` (`src/pages/api/photos/upload.ts`).

DB bypass of Zod → **500** `DATABASE_ERROR` (`src/pages/api/actions/index.ts:104-112`), not 4xx.

#### Existing validation tests

| Covered | Not covered |
|---------|-------------|
| Notes >1000, XOR name fields, unknown plant (random UUID), photo MIME/size, 6th photo | 300/301 char name, invalid dates, whitespace-only name, rejection DB read-back (no orphan rows), 6th photo DB count stays 5, nonexistent `action_type_id` |

**Verified response guidance:**
- ✓ Must challenge client-only validation — server Zod exists; gaps are **untested boundaries**
- ✓ Anti-pattern "mirror zod as oracle" — current tests repeat implementation constants (`"x".repeat(1001)`, `11 * 1024 * 1024`); photo success test shows good pattern (DB read-back at `upload.test.ts:82-88`)

**Recommended independent oracles:**
- PRD-named constants in test file (300, 1000, 5, 10MB) — do not import from app code
- After 400 rejections: `SELECT COUNT(*) FROM actions` / `photos` proves no partial rows
- Boundary pairs: 300 accept / 301 reject; 1000 accept / 1001 reject

---

### Test infrastructure (cross-cutting)

| Component | Location | Notes |
|-----------|----------|-------|
| Vitest config | `vitest.config.ts` | Node env, `src/**/*.test.ts`, setup `test-setup.ts` |
| Local Supabase forcing | `src/lib/test-setup.ts:9-25` | Overwrites env to `127.0.0.1:54321` |
| Helpers | `src/lib/test-utils.ts` | `seedTestData`, `cleanupTestData`, `createTestFile` — no two-user or sign-in helpers |
| Invocation | All API tests | `fetch` to dev server — not direct handler import |
| CI | `.github/workflows/ci.yml` | lint + build only; integration not in CI (Phase 3 scope) |

**Prerequisites:** `npx supabase start` + `npm run dev` (documented in test file headers).

## Code References

- `src/pages/api/actions/index.ts:12-31` — action create Zod schema
- `src/pages/api/actions/index.ts:41-122` — POST handler
- `src/lib/plant-page.ts:133-201` — list loader with `last_action`
- `src/lib/plant-page.ts:364-453` — card page loader
- `src/lib/action-dates.ts:11-24` — planned partition + date sort
- `src/lib/plant-card-client.ts:69-74` — `partitionActionsByPlanned`
- `src/pages/api/plants/[id].ts:40-77` — GET plant (RLS-gated)
- `src/lib/supabase.ts:51-59` — test harness RLS bypass (critical)
- `src/middleware.ts:9-23` — `X-Test-User-Id` bypass
- `supabase/migrations/20260604120000_core_data_schema.sql:82-132` — RLS policies
- `src/pages/api/photos/upload.test.ts:212-248` — skipped cross-user test
- `src/lib/test-utils.ts:39-112` — single-user seed

## Architecture Insights

1. **Defense in depth varies by route:** list queries filter `user_id` explicitly; by-ID routes rely solely on RLS.
2. **Test auth is not production auth:** service-role client makes all authenticated integration tests run as superuser — fine for happy-path contract tests, invalid for ownership tests.
3. **"Last action" is surface-dependent:** list uses max `date` including planned; card "Last activity" excludes planned — tests must assert the correct surface semantics.
4. **Validation split:** strong at API layer for common cases; DB backs name length and XOR only; photo count and notes length are API-only.

## Historical Context (from prior changes)

- `context/changes/photo-storage-setup/plan.md` — documented upload validation expectations (max 5, MIME, size)
- `context/changes/core-data-schema/plan.md` — RLS and schema design for plants/actions/photos
- `context/foundation/test-plan.md:53-58` — Risk response guidance that drove this research

## Response-Guidance Corrections vs Test Plan

| Risk | Test plan assumption | Research finding |
|------|---------------------|------------------|
| #3 | "403/empty for wrong owner" | App returns **404** (`*_NOT_FOUND`) or empty list — no 403 code exists |
| #3 | Integration with two users | **Blocked** until harness stops using service role for `X-Test-User-Id` |
| #1 | Card + list both show new action | True for past/today dates; future dates show on list `last_action` and card **Upcoming**, not "Last activity" |
| #6 | 4xx on invalid input | Nonexistent `action_type_id` may return **500** (FK), not 400 |

## Open Questions

1. **Harness design:** User-scoped anon client vs real cookie sign-in — which is cheaper to implement while preserving HTTP integration pattern?
2. **Phase 1 scope:** Should harness fix be a separate plan sub-phase before ownership tests, or bundled with first cross-user test?
3. **Dev server in CI:** Deferred to Phase 3 — confirm Phase 1 tests remain local-only.
4. **PATCH/DELETE actions:** No test file for `src/pages/api/actions/[id].ts` — include in Phase 1 ownership coverage or defer?

## Related Research

- None prior for this change folder (first research artifact).
