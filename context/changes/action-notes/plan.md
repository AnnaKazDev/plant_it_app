# Action Notes Implementation Plan

## Overview

Close the gap between PRD (“additional text can be also added”) and the current app: let users add optional free-text notes when creating an action and see them on the plant card teaser. Reuse existing `actions.additional_data` column — no migration.

## Current State

- **DB:** `additional_data TEXT` on `actions` (no length constraint in schema)
- **API:** `POST /api/actions` does not accept or persist `additional_data`; response omits it
- **SSR loader:** `loadPlantCardPageData` does not select `additional_data` (`PlantCardAction` type lacks the field)
- **GET API:** `GET /api/plants/[id]` already returns `additional_data`
- **UI:** `AddActionForm` has no notes field; `ActionTeaser` does not render notes

## Desired End State

Logged-in user on `/plants/[id]` can:

1. Optionally enter notes (e.g. “Used organic fertilizer, 5L water”) when adding an action
2. See notes on the action teaser when present (hidden when empty)
3. Rely on API integration test proving create + round-trip

## What We're NOT Doing

- Rename DB column (`additional_data` stays; UI label “Notes”)
- Edit/delete actions or notes on existing actions
- Rich text / markdown
- Notes on plant list teasers (S-04)
- Schema migration or new routes

## Implementation Approach

Two phases — backend + UI first, then tests.

```
AddActionForm (optional notes textarea)
    ↓ POST /api/actions { additional_data? }
loadPlantCardPageData + ActionTeaser (show notes when set)
```

---

## Phase 1: API, Loader, and UI

### Overview

Wire optional notes through create API, SSR loader, form, and teaser.

### Changes Required

#### 1. POST /api/actions

**File:** `src/pages/api/actions/index.ts`

**Contract:** Add optional `additional_data` to zod schema: `z.string().max(1000).optional()` (trim empty string → omit/null). Persist on insert. Include `additional_data` in `.select()` response.

#### 2. SSR loader + type

**File:** `src/lib/plant-page.ts`

**Contract:** Add `additional_data` to actions select and `PlantCardAction` interface.

#### 3. Add action form

**File:** `src/components/plants/AddActionForm.tsx`

**Contract:** Optional `<textarea>` labeled “Notes” (or “Additional notes”), `maxLength={1000}`, client validation aligned with API. Send `additional_data` only when trimmed non-empty.

#### 4. Action teaser

**File:** `src/components/plants/ActionTeaser.tsx`

**Contract:** When `action.additional_data` is non-empty, render below date as muted secondary text. No layout change when absent.

### Success Criteria

#### Automated

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual

- Add action with notes → teaser shows notes after reload
- Add action without notes → teaser unchanged (no empty line)
- Notes near 1000 chars rejected or truncated per validation

**Implementation Note:** Pause for manual confirmation before Phase 2.

---

## Phase 2: Integration Tests and Close-Out

### Overview

Automate create-with-notes and verify GET/SSR path returns the value.

### Changes Required

#### 1. Extend action create tests

**File:** `src/pages/api/actions/index.test.ts`

**Contract:** POST with `additional_data: "Used compost mix"` → 201; response includes same text. POST with `additional_data` > 1000 chars → 400.

#### 2. Plant GET round-trip (optional if covered above)

**File:** `src/pages/api/plants/[id].test.ts`

**Contract:** After creating action with notes, GET plant includes `additional_data` on matching action.

### Success Criteria

#### Automated

- `npm run test:integration` passes
- `npm run lint` passes

#### Manual

- N/A

---

## Testing Strategy

- Integration: create with/without notes, validation edge, GET round-trip
- Manual: form + teaser on plant card

## References

- PRD user journey: `context/foundation/prd.md` (“Additional text can be also added”)
- S-02 deferral: `context/changes/first-plant-first-action/plan.md` (`additional_data` — no UI in S-02)
- Archived S-03: `context/archive/2026-06-12-multiple-actions-tracking/`
- Migration: `supabase/migrations/20260604120000_core_data_schema.sql` (`additional_data TEXT`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API, Loader, and UI

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run check` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 Notes visible on plant card after add; empty notes leave teaser unchanged

### Phase 2: Integration Tests and Close-Out

#### Automated

- [ ] 2.1 `npm run test:integration` passes
- [ ] 2.2 `npm run lint` passes
