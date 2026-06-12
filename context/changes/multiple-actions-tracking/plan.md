# Multiple Actions Tracking Implementation Plan

## Overview

Deliver roadmap slice S-03 by hardening the multi-action plant card flow that S-02 already implements. S-02 proved create + list + Planned badge on `/plants/[id]`; this change extracts shared date/sort logic, adds integration test coverage for multi-action scenarios (past/today/future dates, newest-first ordering), and documents explicit scope boundaries (FR-010 plant-list badges deferred to S-04). No schema migration, no new routes, minimal UI changes.

## Current State Analysis

**What S-02 already delivers (no rework needed):**

- `POST /api/actions` — create with XOR name validation, any parseable date (past/today/future), weather fetch for historical dates (`src/pages/api/actions/index.ts`)
- Plant card at `/plants/[id]` — lists all actions, repeated `AddActionForm`, full page reload after add (`src/components/plants/PlantCardContent.tsx`, `AddActionForm.tsx`)
- `ActionTeaser` — photo/placeholder, action name + emoji, formatted date, weather or "Weather unavailable", **Planned** badge for future dates (`src/components/plants/ActionTeaser.tsx`)
- Actions sorted **newest first** in both SSR loader and API (`src/lib/plant-page.ts:131`, `src/pages/api/plants/[id].ts:83`)
- Integration tests for single-action create paths (`src/pages/api/actions/index.test.ts`)

**Gaps for S-03:**

- Date helpers (`isPlannedAction`, `formatActionDate`) are private to `ActionTeaser.tsx` — sort comparator duplicated in loader and API
- No integration test for future-dated (planned) action creation
- No integration test for `GET /api/plants/[id]` with multiple actions or sort order
- FR-010 (plant-list planned badge/count) not started — correctly deferred to S-04 (no `/plants` page exists)
- S-02 manual step 6 covers multi-action Planned badge but is not automated

### Key Discoveries:

- S-02 impl-review accepted native `<select>` + `<input type="date">` — keep in S-03 (`context/changes/first-plant-first-action/reviews/impl-review.md` F1)
- Future dates get `weather_data: null` because `WeatherService` uses history API only — acceptable per planning decision; teaser shows "Weather unavailable"
- `isPlannedAction` uses browser-local "end of today" boundary — accepted; no garden-timezone lookup needed for MVP
- Loader (`plant-page.ts`) and API (`plants/[id].ts`) duplicate sort + sign-URL logic — extract sort helper only; loader pattern stays intentional per S-02 addendum

## Desired End State

A logged-in user on `/plants/[id]` can:

1. Add multiple actions with past, today, or future dates (unchanged flow from S-02)
2. See all action teasers in **newest-first** order with Planned badge on future-dated entries
3. See "Weather unavailable" on planned actions (no forecast integration)
4. Rely on automated tests proving multi-action create + GET sort order

**Verification:** `npm run lint`, `npm run check`, `npm run build`, `npm run test:integration` pass; manual walkthrough of multi-action scenarios on plant card.

## What We're NOT Doing

- **Plant list view or FR-010 list badges** — deferred to S-04 (`plant-list-view`)
- **Edit or delete actions** — create-only; same as S-02
- **Visual timeline redesign** — keep flat `ActionTeaser` card list
- **shadcn combobox/calendar upgrade** — keep native controls (accepted S-02 simplification)
- **Garden-location timezone** — Planned badge uses browser-local date
- **Forecast weather for future actions** — show "Weather unavailable"
- **Schema migration** — actions table unchanged
- **UI/browser automated tests** — API integration tests only
- **Refactor plant card to call GET API** — SSR loader remains intentional

## Implementation Approach

**Three phases**, utilities first so tests and UI share one source of truth for date/sort behavior:

1. **Shared action utilities** — extract `action-dates.ts`, wire into teaser, loader, API
2. **Integration test coverage** — multi-action POST + GET sort verification
3. **Verification** — manual checklist; mark change planned

```
AddActionForm → POST /api/actions (any date) → reload
                    ↓
PlantCardContent ← loadPlantCardPageData (sort via shared helper)
                    ↓
ActionTeaser (isPlannedAction via shared helper → Planned badge)
```

## Phase 1: Shared Action Utilities

### Overview

Centralize date formatting, planned detection, and sort comparator so UI, SSR loader, and API stay consistent as multi-action usage grows.

### Changes Required:

#### 1. Action date helpers

**File**: `src/lib/action-dates.ts`

**Intent**: Single module for action date display, planned detection, and sort order used by plant card UI and data loaders.

**Contract**: Export `formatActionDate(isoDate: string): string` (locale short date, same output as current `ActionTeaser`); `isPlannedAction(isoDate: string): boolean` (true when `actionDate > end of today` in local timezone); `compareActionsByDateDesc(a: { date: string }, b: { date: string }): number` (newest first, for `.sort()`).

#### 2. ActionTeaser

**File**: `src/components/plants/ActionTeaser.tsx`

**Intent**: Remove duplicated private date helpers; import from shared module.

**Contract**: Delete local `formatActionDate` and `isPlannedAction`; import from `@/lib/action-dates`. Visual output unchanged.

#### 3. Plant card SSR loader

**File**: `src/lib/plant-page.ts`

**Intent**: Use shared sort comparator instead of inline date comparison.

**Contract**: Replace `.sort((a, b) => new Date(b.date)...)` with `.sort(compareActionsByDateDesc)`.

#### 4. Plant GET API

**File**: `src/pages/api/plants/[id].ts`

**Intent**: Keep API response order identical to SSR loader.

**Contract**: Replace inline sort with `compareActionsByDateDesc` from `@/lib/action-dates`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Plant card still shows actions newest-first
- Planned badge still appears on future-dated teasers
- Date formatting unchanged on teasers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Integration Test Coverage

### Overview

Automate the multi-action scenarios S-02 verified manually: future-dated create, past-dated create, and GET plant with multiple actions in correct order.

### Changes Required:

#### 1. Extend action create tests

**File**: `src/pages/api/actions/index.test.ts`

**Intent**: Prove API accepts past and future dates and returns 201; document expected weather behavior for future dates.

**Contract**: Add test cases: (a) create action with future date (e.g. `2030-01-15`) → 201, `weather_data` may be `null`; (b) create action with past date (e.g. `2020-06-01`) → 201. Use same `seedTestData` harness and `X-Test-User-Id` header pattern as existing tests.

#### 2. Plant GET with multiple actions

**File**: `src/pages/api/plants/[id].test.ts` (new)

**Intent**: Verify `GET /api/plants/[id]` returns all actions for a plant sorted newest-first.

**Contract**: In `beforeAll`, create three actions on `testData.plantId` with distinct dates (past, today-ish, future) via `POST /api/actions`. `GET /api/plants/[id]` → 200; `plant.actions.length >= 3`; first action date ≥ second ≥ third (newest-first). Follow prerequisites comment block and cleanup pattern from `index.test.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes (requires local Supabase + dev server)
- `npm run lint` passes

#### Manual Verification:

- N/A — this phase is fully automated

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Verification & Close-Out

### Overview

Manual confirmation of the full multi-action user flow and change folder housekeeping.

### Changes Required:

#### 1. Change metadata

**File**: `context/changes/multiple-actions-tracking/change.md`

**Intent**: Record that planning is complete.

**Contract**: Set `status: planned`; update `updated` to implementation start date when `/10x-implement` begins.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check`, `npm run build` pass (final gate)

#### Manual Verification:

- Register or use existing user with plant on `/plants/[id]`
- Add action with today's date — appears at top of list, no Planned badge
- Add action with future date — Planned badge visible, weather shows "Weather unavailable"
- Add action with past date — appears below newer entries, no Planned badge
- Action count in header updates correctly (e.g. "3 actions")
- Add second plant with actions — confirms flow is not single-plant-specific

**Implementation Note**: After manual verification succeeds, S-03 is complete. FR-010 plant-list badges remain for S-04.

---

## Testing Strategy

### Unit Tests:

- Optional: lightweight tests for `isPlannedAction` edge cases (today vs tomorrow) in `src/lib/action-dates.test.ts` — not required for S-03 given integration coverage; add only if implementer finds boundary bugs

### Integration Tests:

- `POST /api/actions` — future date, past date (extend existing file)
- `GET /api/plants/[id]` — multiple actions, newest-first order (new file)
- Regression: existing S-02 action and plant tests still pass

### Manual Testing Steps:

1. Open plant card with zero actions — empty state + add form visible
2. Add three actions (past, today, future) — verify order and Planned badge
3. Confirm weather line on planned action reads "Weather unavailable"
4. Confirm page reload after add still works (no regression)

## Performance Considerations

- No change to SSR query shape — still one joined fetch for plant + actions + photos
- Shared sort helper is O(n log n) on action count; typical plant has <20 actions — negligible
- Full page reload on add action remains S-02 behavior; client-side refresh out of scope

## Migration Notes

No database migration. Existing `actions.date` TIMESTAMPTZ values work unchanged.

## References

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD FR-007–FR-010: `context/foundation/prd.md`
- S-02 plan (baseline): `context/changes/first-plant-first-action/plan.md`
- S-02 impl-review: `context/changes/first-plant-first-action/reviews/impl-review.md`
- ActionTeaser: `src/components/plants/ActionTeaser.tsx`
- Plant loader: `src/lib/plant-page.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared Action Utilities

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run check` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 Plant card shows actions newest-first with Planned badge unchanged

### Phase 2: Integration Test Coverage

#### Automated

- [ ] 2.1 `npm run test:integration` passes
- [ ] 2.2 `npm run lint` passes

### Phase 3: Verification & Close-Out

#### Automated

- [ ] 3.1 `npm run lint`, `npm run check`, `npm run build` pass

#### Manual

- [ ] 3.2 Multi-action manual walkthrough (past/today/future) succeeds
