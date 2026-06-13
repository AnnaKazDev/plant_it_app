# Plant List View Implementation Plan

## Overview

Deliver roadmap slice S-04: a logged-in user sees `/plants` — a list of all their plants, each row showing display name with grid coordinates, a last-action teaser (photo + action + date + weather via reused `ActionTeaser`), optional action notes, and a planned-action count badge when future-dated actions exist. Includes `GET /api/plants` for integration tests and dashboard navigation when the user has at least one plant.

## Current State Analysis

**What exists:**

- Plant create + card flows from S-02/S-03: `POST /api/plants`, `GET /api/plants/[id]`, `/plants/new`, `/plants/[id]`
- `ActionTeaser` + `PlantAvatar` in `src/components/plants/ActionTeaser.tsx` — photo, action label, date, notes, weather, per-action **Planned** badge
- SSR loaders in `src/lib/plant-page.ts` (`loadPlantCardPageData`) with signed URLs and action sorting via `compareActionsByDateDesc`
- Date helpers in `src/lib/action-dates.ts` (`isPlannedAction`, `formatActionDate`, `compareActionsByDateDesc`)
- `formatPlantDisplayName` in `src/lib/plants.ts`; `PlantWithLastAction` type in `src/types.ts` (unused)
- Middleware already protects `/plants` and `/api/plants` (`src/middleware.ts` line 6)
- Dashboard shows plant count but only links to `/plants/new` (`src/pages/dashboard.astro`)

**What's missing:**

- No `/plants` index page (`src/pages/plants/index.astro`)
- No `GET /api/plants` handler (`src/pages/api/plants/index.ts` is POST-only)
- No `loadPlantListPageData` or list row types
- No `PlantListContent` / `PlantListItem` components
- No dashboard CTA to the list; FR-010 plant-level planned count on list not implemented

### Key Discoveries:

- S-02/S-03 intentionally deferred `/plants` list to S-04 (`context/changes/first-plant-first-action/plan.md` line 50)
- `plants.updated_at` exists in schema but has no trigger to bump on action insert — sort by **last action date** (fallback `plants.created_at`), not `plants.updated_at` alone
- Nested `actions (...)` on a plants query loads **all** actions per plant — wasteful for list; use **two bulk queries** (plants + actions filtered by `plant_id`) then aggregate in JS
- `ActionTeaser` already renders `additional_data` notes — reusing it on the list satisfies the decision to show notes without a separate variant
- Roadmap NFR: list should load within ~2 seconds for 10+ plants — avoid N+1 signed-URL calls per action photo beyond one plant avatar + one last-action photo per row

## Desired End State

A logged-in user with one or more plants can:

1. Click **View my plants** on `/dashboard` (when `plantCount > 0`) → `/plants`
2. See all plants sorted by most recent activity (newest last-action date first; plants with no actions sorted by `created_at`)
3. Each row is a single clickable link to `/plants/[id]` showing:
   - Plant display name with coordinates (e.g. `Sunflower (B7)`)
   - Planned-action count badge when count > 0 (e.g. `2 planned`)
   - Last-action `ActionTeaser` when actions exist, OR plant photo + name only when no actions (FR-005 empty state)
4. Visit `/plants` with zero plants → dedicated empty state + **Add your first plant** CTA → `/plants/new`
5. `GET /api/plants` returns the same list shape for authenticated users (integration tests)

**Verification:** `GET /api/plants` integration tests pass; manual list walkthrough with 0, 1, and 2+ plants; `npm run lint`, `npm run check`, `npm run build` clean.

## What We're NOT Doing

- **Garden map** (`/garden-map`) — S-05
- **Edit/delete plants or actions** — still out of scope
- **Search / filter / pagination** — FR-016 parked post-MVP
- **Topbar Plants link** — dashboard CTA only for this slice
- **Redirect after plant create to list** — keep existing redirect to `/plants/[id]` from `AddPlantForm`
- **Schema migration or new DB views/RPCs** — aggregate last action in application layer
- **Thumbnail optimization / lazy loading** — deferred from F-02; full signed URLs acceptable for MVP plant counts
- **Automated UI/browser tests** — API integration tests only
- **Notes-free list teaser variant** — user chose to show notes on list via full `ActionTeaser`

## Implementation Approach

**Four phases**, data layer first so page and API share one query function:

1. **Data layer** — shared list fetcher, SSR loader, `GET /api/plants`
2. **List UI** — `/plants` page + React list components reusing `ActionTeaser` / `PlantAvatar`
3. **Navigation + empty states** — dashboard CTA, zero-plant empty state on list
4. **Tests & verification** — `GET /api/plants` integration tests

**Architecture:**

```
Dashboard (plantCount > 0) → /plants/index.astro
                                  ↓ loadPlantListPageData (SSR)
                             PlantListContent (React)
                                  ↓ map → PlantListItem (<a> → /plants/[id])
                             PlantAvatar + name + planned count + ActionTeaser | empty state

GET /api/plants → same fetchPlantListForUser(supabase, userId) → JSON
```

## Critical Implementation Details

**Sort key:** For each plant, `activityDate = last_action?.date ?? plant.created_at`. Sort plants descending by `activityDate`. Do not rely on `plants.updated_at` — it is not updated when actions are added.

**Last action selection:** Among a plant's actions, pick the one with the greatest `date` (use `compareActionsByDateDesc`; ties are acceptable — first after sort).

**Planned count:** Count actions where `isPlannedAction(action.date)` is true. Display as a badge on the row only when `count > 0` (e.g. `1 planned` / `2 planned`). Independent of whether the **last** action is planned — a plant can show a past last action teaser plus a planned count badge for other future actions.

**Bulk fetch:** Query 1 — all plants for `user_id`. Query 2 — all actions (with nested `photos`, `action_types`) where `plant_id` in plant IDs. Group in memory. Sign URLs for plant photo + last-action first photo only (parallel `Promise.all` per plant row, same as card loader).

## Phase 1: Data Layer

### Overview

Add list types, shared fetch logic, SSR loader, and `GET /api/plants` handler.

### Changes Required:

#### 1. List types and shared fetcher

**File**: `src/lib/plant-page.ts`

**Intent**: Extend the plant-page module with list-specific types and a shared function that both the Astro page and API route call, avoiding duplicated Supabase query logic.

**Contract**: Add `PlantListItem` (`id`, `display_name`, `signed_photo_url`, `last_action: PlantCardAction | null`, `planned_action_count: number`) and `PlantListPageData` (`plants: PlantListItem[]`). Export `fetchPlantListForUser(supabase, userId): Promise<PlantListItem[]>` implementing the two-query bulk fetch, last-action pick, planned count, activity sort, and signed URL signing (reuse private `signPhotoUrl`). Export `loadPlantListPageData(requestHeaders, cookies, userId): Promise<PlantListPageData>`.

#### 2. GET /api/plants

**File**: `src/pages/api/plants/index.ts`

**Intent**: Add read endpoint for the plant list, mirroring SSR data for tests and future clients.

**Contract**: Export `GET` handler (keep existing `POST`). Require `context.locals.user`; return `401` with `ERROR_CODES.UNAUTHORIZED` if missing. Call `fetchPlantListForUser`; respond `200` with `{ success: true, plants: PlantListItem[] }`. Keep `export const prerender = false`.

### Success Criteria:

#### Automated Verification:

- `npm run check` passes
- `npm run lint` passes

#### Manual Verification:

- Temporarily log or inspect loader output in dev with 2+ plants — confirm sort order and planned counts look correct

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: List UI

### Overview

Create the `/plants` page and React components that render the list using SSR props.

### Changes Required:

#### 1. Plant list page

**File**: `src/pages/plants/index.astro`

**Intent**: SSR shell for the plant list, matching layout patterns from `plants/[id].astro` and `dashboard.astro`.

**Contract**: Call `loadPlantListPageData` when `user` is present; pass `plants` array to `PlantListContent` via `client:only="react"`. Page title e.g. "My plants". Use `bg-cosmic` + card container styling consistent with other plant pages.

#### 2. List container component

**File**: `src/components/plants/PlantListContent.tsx`

**Intent**: Render page header, optional **Add plant** link to `/plants/new`, and map plants to rows or empty state.

**Contract**: Props: `{ plants: PlantListItem[] }`. When `plants.length === 0`, render empty state (message + CTA to `/plants/new`) — do not redirect. Otherwise render a vertical stack of `PlantListItem`.

#### 3. List row component

**File**: `src/components/plants/PlantListItem.tsx`

**Intent**: One plant row — entire row navigates to the plant card.

**Contract**: Props: single `PlantListItem` from plant-page types. Wrap content in `<a href={/plants/${id}}>` (or Astro-friendly link pattern used elsewhere). Show `display_name` as heading; show planned count badge when `planned_action_count > 0`. If `last_action` present, render `ActionTeaser`; else render `PlantAvatar` + name/coordinates empty state per FR-005.

### Success Criteria:

#### Automated Verification:

- `npm run check` passes
- `npm run lint` passes

#### Manual Verification:

- `/plants` renders with 2 plants — correct order, teasers, notes visible when present
- Row click opens correct `/plants/[id]`
- Plant with no actions shows avatar + name only
- Plant with future actions shows planned count badge even when last action is in the past

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Navigation + Empty States

### Overview

Wire dashboard to the list and ensure zero-plant UX is coherent across dashboard and list.

### Changes Required:

#### 1. Dashboard CTA

**File**: `src/pages/dashboard.astro`

**Intent**: Give users with plants a clear path to the list (PRD journey step 8).

**Contract**: When `plantCount > 0`, add a secondary CTA **View my plants** linking to `/plants` above or below the existing **Add another plant** button. Keep existing copy and primary add CTA unchanged for `plantCount === 0`.

#### 2. Plant card back-link (optional polish)

**File**: `src/components/plants/PlantCardContent.tsx`

**Intent**: Improve navigation from card back to list without requiring dashboard round-trip.

**Contract**: Add a small text link **← All plants** → `/plants` near the top of the card. Skip if it clutters the layout — prefer minimal addition.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes

#### Manual Verification:

- Dashboard with 1+ plants shows **View my plants** → `/plants`
- Dashboard with 0 plants does not show list CTA
- Empty `/plants` shows CTA to add first plant
- Full PRD journey: add two plants with actions → list shows both with correct last-action teasers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Tests & Verification

### Overview

Add integration tests for `GET /api/plants` and run full CI verification.

### Changes Required:

#### 1. GET /api/plants integration tests

**File**: `src/pages/api/plants/index.test.ts` (extend existing file or add `describe("GET /api/plants")` block)

**Intent**: Lock list API behavior against regressions, matching S-02/S-03 test patterns.

**Contract**: Tests using `seedTestData`, `X-Test-User-Id` header, `API_URL` env:
- Returns `401` without auth
- Returns `{ success: true, plants: [] }` for user with no plants
- Returns plant with `last_action` null when plant has no actions
- Returns correct `last_action` (newest by date) when multiple actions exist
- Returns `planned_action_count` matching future-dated actions
- Plants sorted by activity date descending

Use existing test utilities to create plants and actions via API or direct Supabase inserts as other tests do.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes (with local Supabase + dev server)
- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Smoke test production build preview if desired
- Confirm list load feels acceptable with 10+ plants in local dev

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not required for this slice — aggregation logic is covered indirectly via integration tests. Extract pure helpers only if needed for clarity.

### Integration Tests:

- `GET /api/plants` auth, empty list, last-action selection, planned count, sort order
- Reuse `seedTestData` / `cleanupTestData` from `src/lib/test-utils.ts`

### Manual Testing Steps:

1. Sign in → dashboard with 0 plants → no list CTA; `/plants` shows empty state
2. Add plant + action → dashboard shows **View my plants** → list shows one row with teaser
3. Add second plant with only a future-dated action → row shows planned count + Planned on teaser
4. Add past action to that plant → last-action teaser updates; planned count still reflects remaining future actions if any
5. Click row → lands on correct plant card

## Performance Considerations

- Two bulk queries + parallel signed URL signing per row (max 2 URLs per plant) — acceptable for MVP (10–20 plants)
- Avoid nested select of all actions on plants query — use separate actions query grouped in JS
- If list feels slow at scale, future optimization: Postgres `DISTINCT ON` view or materialized last-action column (out of scope)

## Migration Notes

No database migration. Existing RLS on `plants` and `actions` covers list queries.

## References

- Roadmap S-04: `context/foundation/roadmap.md` lines 187–197
- PRD FR-005, FR-009, FR-010: `context/foundation/prd.md` lines 104–127
- Prior slice patterns: `context/changes/first-plant-first-action/plan.md`, `context/archive/2026-06-12-multiple-actions-tracking/plan.md`
- `ActionTeaser`: `src/components/plants/ActionTeaser.tsx`
- SSR loader pattern: `src/lib/plant-page.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 `npm run check` passes
- [x] 1.2 `npm run lint` passes

#### Manual

- [x] 1.3 Loader output verified in dev (sort, last action, planned counts)

### Phase 2: List UI

#### Automated

- [ ] 2.1 `npm run check` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 List page renders correctly for multi-plant, no-action, and planned-count cases
- [ ] 2.4 Row navigation opens correct plant card

### Phase 3: Navigation + Empty States

#### Automated

- [ ] 3.1 `npm run build` passes

#### Manual

- [ ] 3.2 Dashboard list CTA and empty-state journey verified
- [ ] 3.3 Full two-plant PRD journey walkthrough

### Phase 4: Tests & Verification

#### Automated

- [ ] 4.1 `npm run test:integration` passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run check` passes
- [ ] 4.4 `npm run build` passes

#### Manual

- [ ] 4.5 List performance acceptable with 10+ plants in local dev
