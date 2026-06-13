# Garden Map View Implementation Plan

## Overview

Deliver roadmap slice S-05 (FR-014, FR-015; extends FR-013 visualization): a logged-in user opens `/garden-map` and sees all plants on a styled garden grid matching profile dimensions, clicks a plant marker to open its card, and hovers for a rich tooltip (display name + last action + photo). In the same slice, refactor grid UI into a shared `GardenGrid` component, upgrade `GardenGridPicker` on `/plants/new`, and add a curated lucide icon picker persisted as `plants.icon_name`.

## Current State Analysis

**What exists:**

- Coordinate helpers in `src/lib/grid.ts` (`formatGridLabel`, `getGardenGridDimensions`, `isWithinGardenBounds`)
- `GardenGridPicker` — CSS grid with per-cell `<button>` elements, draggable `Sprout` marker (`src/components/plants/GardenGridPicker.tsx`)
- `AddPlantForm` embeds picker; `POST /api/plants` accepts `grid_x`/`grid_y` with bounds validation
- `fetchPlantListForUser` in `src/lib/plant-page.ts` already selects `grid_x`, `grid_y` but drops them from `PlantListItem`
- `PlantAvatar` + `ActionTeaser` patterns in `src/components/plants/ActionTeaser.tsx`
- Middleware protects `/plants` but **not** `/garden-map` (`src/middleware.ts` line 6)
- Dashboard links to `/plants` and `/plants/new` only — no map link
- No `icon_name` on `plants` table; all markers would look identical without migration

**What's missing:**

- `/garden-map` page and `GardenMapView` component
- `loadGardenMapPageData` (garden dimensions + plants with coords, icon, last-action teaser data)
- Shared `GardenGrid`, `plant-icons.ts`, `PlantIconPicker`
- shadcn `Tooltip` component
- Navigation entry points; integration tests for `icon_name` on create

### Key Discoveries:

- Research (`context/changes/garden-map-view/research.md`): sparse map rendering (CSS background grid + N markers) — not 10k DOM nodes
- Multi-cell grządki deferred to **S-06** (`garden-multi-cell`) per roadmap — this slice stays single-cell anchor
- `fetchPlantListForUser` two-query bulk pattern is reusable for map tooltip data (last action + signed photo)
- After migration: run `npm run lint:fix -- src/database.types.ts` per `context/foundation/lessons.md`
- Picker currently renders one `<button>` per cell — refactor to sparse click-snap grid fixes large-garden DOM risk from S-02 impl review

## Desired End State

A logged-in user with garden dimensions and at least one plant can:

1. Open **Garden map** from `/dashboard` (when `plantCount > 0`) or `/plants` → `/garden-map`
2. See a styled rectangular grid (axis labels A/B/… and 1/2/…, soil-tone background) sized to `garden_width × garden_height` meters
3. See each plant as a lucide icon marker at `(grid_x, grid_y)`; multiple plants in the same cell remain visible via small positional offsets (stack/fan within the cell)
4. Hover a marker → tooltip with `display_name`, last-action label (emoji + name or custom text), date, and a small photo thumbnail (or placeholder when none)
5. Click a marker → navigate to `/plants/[id]`
6. On `/plants/new`: pick from ~20 curated plant icons; drag/click sparse grid to place plant; improved visual grid matches map styling
7. `POST /api/plants` accepts optional `icon_name` (validated against allowlist; default `sprout`)

**Verification:** `npm run lint`, `npm run check`, `npm run build` clean; `POST /api/plants` integration tests cover `icon_name`; manual map + picker walkthrough.

## What We're NOT Doing

- **Multi-cell placement** (grządki spanning A1–A4) — S-06 `garden-multi-cell`
- **Drag-and-drop repositioning on the map** — PRD Non-Goals; map is read-only for placement
- **Pan/zoom, non-rectangular gardens, sunlight zones** — PRD Non-Goals
- **Blocking duplicate grid cells** — user chose allow overlaps with visual stack
- **Plant photo as the on-map marker** — marker shows lucide icon; photo appears in tooltip only
- **Edit plant icon/position after create** — no PATCH in this slice
- **New `GET /api/garden-map` endpoint** — SSR loader only (map page); extend `POST` response and existing patterns
- **Automated UI/browser tests**
- **`@tanstack/react-virtual`** — picker moves to sparse interaction; map already sparse

## Implementation Approach

**Four phases:** schema/API first, then shared grid components (picker refactor), then map page, then navigation + tests.

```
Migration (icon_name)
       ↓
POST /api/plants (+ icon_name)     loadGardenMapPageData (SSR)
       ↓                                    ↓
PlantIconPicker → AddPlantForm      garden-map.astro → GardenMapView
       ↓                                    ↓
GardenGridPicker (mode=picker)       GardenGrid (mode=map) + Tooltip
```

**Collision UX (map):** Group markers by `(grid_x, grid_y)`. For `count > 1`, apply deterministic sub-cell offsets (e.g. index-based translate within the cell, max ~4 visible before shrinking icon size). All markers remain clickable.

**Icon allowlist:** `src/lib/plant-icons.ts` exports `PLANT_ICON_OPTIONS` (~20 entries: `id` kebab-case string matching lucide export name, `label`, React icon component). Zod `z.enum([...])` on API. DB default `'sprout'`.

## Critical Implementation Details

**Picker sparse interaction:** Replace per-cell `<button>` grid with a single positioned grid surface: pointer events on the grid background snap to cell via existing `snapPointerToCell` math; keep keyboard arrow navigation on the grid container. This preserves a11y without O(rows×cols) DOM nodes.

**Tooltip on touch:** Radix Tooltip is hover-focused. On map markers, ensure `aria-label` includes `display_name` and coordinates for screen readers; tooltip is enhancement, not sole source of plant name.

**Signed URLs in tooltip:** Reuse `mapLastActionToCardAction` / first photo signing from `plant-page.ts` — map loader should not introduce N+1 queries beyond what list fetch already does.

## Phase 1: Schema and API

### Overview

Add `icon_name` to plants, validate on create, regenerate types.

### Changes Required:

#### 1. Database migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_plant_icon_name.sql`

**Intent**: Persist user-selected plant icon for map and picker display.

**Contract**: `ALTER TABLE public.plants ADD COLUMN icon_name TEXT NOT NULL DEFAULT 'sprout';` Enable RLS unchanged (column inherits existing policies). No new index required.

#### 2. Regenerate database types

**File**: `src/database.types.ts`

**Intent**: Sync generated types with new column.

**Contract**: Run `npx supabase gen types typescript --local > src/database.types.ts` then `npm run lint:fix -- src/database.types.ts`.

#### 3. Plant icon allowlist

**File**: `src/lib/plant-icons.ts`

**Intent**: Single source of truth for ~20 curated lucide icons used by picker, map markers, and API validation.

**Contract**: Export `PLANT_ICON_IDS` (readonly tuple of string literals), `DEFAULT_PLANT_ICON_ID` (`'sprout'`), `PLANT_ICON_OPTIONS` (id + label + Icon component), `isValidPlantIconId(id: string): boolean`, `PlantIcon` render helper accepting `iconName` and `className`.

#### 4. Extend POST /api/plants

**File**: `src/pages/api/plants/index.ts`

**Intent**: Accept and persist `icon_name` on plant create.

**Contract**: Extend `plantBodySchema` with `icon_name: z.enum(PLANT_ICON_IDS).optional().default(DEFAULT_PLANT_ICON_ID)`. Include `icon_name` in insert and JSON response. Multipart form: read `icon_name` field when present.

#### 5. Extend list fetcher (shared map data)

**File**: `src/lib/plant-page.ts`

**Intent**: Expose coords and icon for map without a duplicate query module.

**Contract**: Add `GardenMapPlant` type: `id`, `display_name`, `grid_x`, `grid_y`, `icon_name`, `signed_photo_url`, `last_action: PlantCardAction | null`. Export `fetchGardenMapPlantsForUser(supabase, userId)` — same two-query bulk pattern as `fetchPlantListForUser`, including `icon_name` in plants select. Export `loadGardenMapPageData(headers, cookies, userId)` returning `{ gardenWidth, gardenHeight, gardenName?, hasGardenSetup, plants: GardenMapPlant[] }` (profile dimensions from existing `loadAddPlantPageData` pattern).

### Success Criteria:

#### Automated Verification:

- Migration applies: `npx supabase db reset` or `npx supabase migration up` (local)
- `npm run lint` passes
- `npm run check` passes

#### Manual Verification:

- Existing plants receive `icon_name = 'sprout'` after migration

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Shared GardenGrid and Picker Upgrade

### Overview

Extract shared grid visuals; add icon picker; refactor `GardenGridPicker` to sparse interaction and new styling.

### Changes Required:

#### 1. Install shadcn Tooltip

**File**: `src/components/ui/tooltip.tsx` (generated)

**Intent**: Accessible hover tooltips for map markers.

**Contract**: Add via `npx shadcn@latest add tooltip` (new-york style). Adds `@radix-ui/react-tooltip` dependency.

#### 2. GardenGrid base component

**File**: `src/components/plants/GardenGrid.tsx`

**Intent**: Shared grid chrome: dimensions, `cellSize` calculation (extract `MIN_CELL_PX`/`MAX_CELL_PX` logic from current picker), axis labels, soil-tone background with CSS grid lines, scroll container (`max-h-96 overflow-auto` or similar for large gardens).

**Contract**: Props include `gardenWidth`, `gardenHeight`, `children` (markers overlay), optional `onCellSelect?(gridX, gridY)` for picker mode, `interactive?: boolean`. Export shared `computeCellSize(rows, cols, maxViewportPx?)` from `src/lib/grid.ts` or colocated helper.

#### 3. PlantIconPicker

**File**: `src/components/plants/PlantIconPicker.tsx`

**Intent**: Toggle group of ~20 icons for add-plant form.

**Contract**: Props: `value: string`, `onChange(id: string) => void`. Render grid of icon buttons with `aria-pressed`, `aria-label` per option. Use `PLANT_ICON_OPTIONS`.

#### 4. Refactor GardenGridPicker

**File**: `src/components/plants/GardenGridPicker.tsx`

**Intent**: Thin wrapper using `GardenGrid` + single draggable marker with selected lucide icon (preview icon passed as prop).

**Contract**: Props add `iconName: string`. Remove per-cell button grid; use sparse snap + keyboard nav. Keep `onChange(gridX, gridY)` contract for `AddPlantForm`.

#### 5. Wire AddPlantForm

**File**: `src/components/plants/AddPlantForm.tsx`

**Intent**: Persist selected icon on create.

**Contract**: State `iconName` default `sprout`. Render `PlantIconPicker`. Pass `iconName` to `GardenGridPicker`. Include `icon_name` in JSON and multipart POST bodies.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- `/plants/new`: icon picker works; grid looks improved; drag/click/keyboard placement works
- Create plant with custom icon; verify DB row `icon_name`

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Garden Map Page and View

### Overview

SSR map page with markers, tooltips, collision offsets, empty state.

### Changes Required:

#### 1. GardenMapView component

**File**: `src/components/plants/GardenMapView.tsx`

**Intent**: Read-only map: `GardenGrid` + plant markers as `<a href="/plants/{id}">` wrapping lucide icon in styled circle.

**Contract**: Props: `gardenWidth`, `gardenHeight`, `gardenName?`, `plants: GardenMapPlant[]`. Group plants by cell for offset. Wrap each marker in `Tooltip` showing: `display_name`, action label (reuse `ActionTeaser` label helper or inline same logic), `formatActionDate`, thumbnail via small `img` or `PlantAvatar` sized down. `aria-label` on link: `{display_name} at {formatGridLabel(...)}`.

#### 2. Map page

**File**: `src/pages/garden-map.astro`

**Intent**: Protected SSR page loading garden profile + plants.

**Contract**: Mirror `src/pages/plants/index.astro` layout shell (`bg-cosmic`, card container). Call `loadGardenMapPageData` when `user` present. Render `GardenMapView` with `client:load` (tooltips need hydration). Empty state when `plants.length === 0`: message + CTA to `/plants/new`. Missing garden setup: link to profile/signup guidance (match `plants/new.astro` pattern).

#### 3. Middleware

**File**: `src/middleware.ts`

**Intent**: Require auth for `/garden-map`.

**Contract**: Add `"/garden-map"` to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Map shows all plants at correct positions
- Two plants same cell: both visible (offset)
- Tooltip shows name + last action + photo
- Click navigates to plant card
- Empty garden / no plants states render correctly

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Navigation, Tests, and Verification

### Overview

Link map from dashboard and plant list; integration tests for `icon_name`; full CI pass.

### Changes Required:

#### 1. Dashboard navigation

**File**: `src/pages/dashboard.astro`

**Intent**: Discoverability per PRD journey step 12.

**Contract**: When `plantCount > 0`, add secondary link **View garden map** → `/garden-map` (between list and add-plant buttons).

#### 2. Plant list navigation (optional header link)

**File**: `src/components/plants/PlantListContent.tsx`

**Intent**: Second entry point from list view (roadmap: "likely linked from `/plants`").

**Contract**: Add compact text link or button **Garden map** → `/garden-map` in list header area.

#### 3. Integration tests

**File**: `src/pages/api/plants/index.test.ts`

**Intent**: Lock `icon_name` API contract.

**Contract**: Add tests: create with valid `icon_name` returns it; omit `icon_name` defaults to `sprout`; invalid `icon_name` returns `400 VALIDATION_ERROR`.

#### 4. Test utils seed (if needed)

**File**: `src/lib/test-utils.ts`

**Intent**: Ensure seeded plants remain valid after migration default.

**Contract**: No change required if DB default handles existing seeds; add `icon_name` to seed insert only if explicit insert list omits new column.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes (local Supabase + dev server)
- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Dashboard → garden map → plant card full journey
- Regression: plant list and add-plant still work

---

## Testing Strategy

### Unit Tests:

- Optional: `isValidPlantIconId` / `computeCellSize` if extracted to `grid.ts` — not required if covered by integration + manual

### Integration Tests:

- `POST /api/plants` with `icon_name` valid / default / invalid
- Existing POST tests still pass (bounds, auth, multipart)

### Manual Testing Steps:

1. Register user with 5×8 m garden; add 3 plants at different cells with different icons
2. Open `/garden-map` — verify positions and icons
3. Add two plants at same cell — verify both markers visible
4. Hover each marker — tooltip content and photo
5. Click marker → plant card
6. Large garden profile (e.g. 30×30) — scroll container works; picker remains responsive
7. Mobile viewport — map scrolls; tooltip usable or `aria-label` sufficient

## Performance Considerations

- Map: O(plants) DOM nodes, not O(rows×cols)
- Picker: sparse grid removes 10k-button risk
- Tooltip photos: one signed URL per plant from bulk fetch (already paid in loader)
- `client:load` on map island — acceptable for above-the-fold map page

## Migration Notes

- Existing plants get `icon_name = 'sprout'` via column default
- No backfill job required
- S-06 multi-cell will add columns later — do not pre-empt with span fields

## References

- Research: `context/changes/garden-map-view/research.md`
- Roadmap S-05/S-06: `context/foundation/roadmap.md`
- List fetch pattern: `context/archive/2026-06-13-plant-list-view/plan.md`
- Picker baseline: `src/components/plants/GardenGridPicker.tsx`
- Lessons (types lint): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema and API

#### Automated

- [x] 1.1 Migration applies locally — c57cf1f
- [x] 1.2 `npm run lint` passes — c57cf1f
- [x] 1.3 `npm run check` passes — c57cf1f

#### Manual

- [x] 1.4 Existing plants have `icon_name = 'sprout'` after migration — c57cf1f

### Phase 2: Shared GardenGrid and Picker Upgrade

#### Automated

- [x] 2.1 `npm run lint` passes — 2864c72
- [x] 2.2 `npm run check` passes — 2864c72
- [x] 2.3 `npm run build` passes — 2864c72

#### Manual

- [x] 2.4 Picker UX verified on `/plants/new` with icon selection — 2864c72

### Phase 3: Garden Map Page and View

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run check` passes
- [x] 3.3 `npm run build` passes

#### Manual

- [x] 3.4 Map markers, tooltips, collisions, and navigation verified

### Phase 4: Navigation, Tests, and Verification

#### Automated

- [ ] 4.1 `npm run test:integration` passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run check` passes
- [ ] 4.4 `npm run build` passes

#### Manual

- [ ] 4.5 Dashboard → map → card journey verified; no regressions on list/add-plant
