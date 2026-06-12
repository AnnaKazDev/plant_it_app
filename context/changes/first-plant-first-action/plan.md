# First Plant + First Action Implementation Plan

## Overview

Deliver roadmap slice S-02 (north star): a logged-in user adds their first plant with optional photo and drag-and-drop grid placement, adds their first action with photos and date, and sees a plant card with an action teaser (photo, action name, date, weather or fallback). Foundations (F-01 schema, F-02 photo storage, F-03 weather client, S-01 registration) are complete; this change builds the first domain APIs, pages, and React forms on top.

## Current State Analysis

**What exists:**

- Database: `plants`, `actions`, `action_types` (30 seeded), `photos`, `profiles` with RLS (`supabase/migrations/20260604120000_core_data_schema.sql`)
- Photo upload: `POST /api/photos/upload` for action photos (`src/pages/api/photos/upload.ts`, `src/lib/storage.ts`)
- Weather: `WeatherService` with lat/lng history fetch + city validation (`src/lib/weather.ts`); used at signup only
- Registration: city + garden dimensions stored on profile (`location_city`; `location_lat`/`location_lng` NULL)
- Types: entity aliases and composite types in `src/types.ts` (`PlantWithLastAction`, `ActionWithPhotos`, etc.) — unused in UI
- Auth middleware: protects `/dashboard` and `/api/photos` only (`src/middleware.ts`)

**What's missing:**

- No `/api/plants` or `/api/actions` routes
- No plant photo upload path (`plants.photo_url` has no write flow)
- No signed URL helper for private bucket display
- No city-based weather fetch for action dates
- No `/plants/new` or `/plants/[id]` pages or plant/action UI components
- Dashboard is a placeholder with sign-out only

### Key Discoveries:

- Storage RLS checks first path segment = `auth.uid()` — plant photos at `{user_id}/plants/{plant_id}/...` remain compatible (`src/lib/storage.ts`, `20260604180000_photo_storage_setup.sql`)
- `getPublicUrl()` on private bucket does not serve images to browsers — signed URLs required at display time (deferred in F-02, now required for S-02)
- Grid stored as integers (`grid_x`, `grid_y`); PRD display format "A3" needs format/parse helpers, not schema change (`context/changes/core-data-schema/plan-brief.md`)
- Weather history API accepts city name in `q` parameter (same as `validateCityName`) — no geocoding needed for S-02
- `PROTECTED_ROUTES` must be extended for new pages and APIs or unauthenticated users get partial access

## Desired End State

A logged-in user with a completed profile can:

1. Click **Add your first plant** on `/dashboard` → `/plants/new`
2. Enter plant name, optionally upload a plant photo, drag a marker onto a garden grid (sized from profile `garden_width` × `garden_height`), submit
3. Land on `/plants/[id]` with a prompt to add the first action
4. Add an action via combobox (predefined or custom name), calendar date (past/today/future), up to 5 photos
5. See action teaser: first photo (or placeholder icon), action name with emoji if predefined, date, weather summary or "Weather unavailable", **Planned** badge if date is in the future
6. Display name follows FR-004: `{name} ({gridLabel})` e.g. "Calendula (A3)"

**Verification:** integration tests pass for plant and action APIs; manual walkthrough of full flow; `npm run lint`, `npm run check`, `npm run build` clean.

## What We're NOT Doing

- **Plant list view** (`/plants`) — deferred to S-04; US-01 list criterion satisfied in a later slice
- **Edit or delete** plants/actions — create-only in S-02
- **Garden map view** (`/garden-map`) — deferred to S-05
- **Geocoding / storing lat/lng on profile** — weather uses `location_city` for S-02
- **Storage blob cleanup on delete** — still deferred from F-02
- **Weather retry UI** — graceful save with NULL weather + teaser fallback (no blocking modal)
- **Moon phase in teasers** — PRD defers to calendar only
- **`additional_data` on actions** — column exists but no UI in S-02
- **Automated UI/browser tests** — API integration tests only
- **Multiple plants / multiple actions polish** — S-02 proves single-plant + single-action path; S-03 expands

## Implementation Approach

**Four phases**, backend-first so UI can call stable APIs:

1. **Backend foundation** — domain APIs, weather-by-city, signed URLs, plant photo upload
2. **Add plant page** — `/plants/new` with drag-and-drop grid + optional plant photo
3. **Plant card page** — `/plants/[id]` with teaser, add-action form, planned badge
4. **Dashboard + wiring** — onboarding CTA, middleware, integration tests

**Architecture:**

```
Dashboard CTA → /plants/new (React: AddPlantForm + GardenGridPicker)
                    ↓ POST /api/plants [+ optional plant photo]
              /plants/[id] (Astro SSR: plant + actions; React: AddActionForm)
                    ↓ POST /api/actions → WeatherService(city) → weather_data
                    ↓ POST /api/photos/upload (per file, after action exists)
              ActionTeaser (signed photo URL, weather or fallback, Planned badge)
```

## Critical Implementation Details

**Grid sizing:** Treat each grid cell as 1 meter. `cols = floor(garden_width)`, `rows = floor(garden_height)` from profile. `grid_x` ∈ [0, rows−1] (row index, 0 = row A), `grid_y` ∈ [0, cols−1] (column index, 0 = column 1). Display label: `String.fromCharCode(65 + grid_x) + (grid_y + 1)`.

**Drag-and-drop:** Marker snaps to nearest cell on drop; store integer `grid_x`/`grid_y`. Validate bounds server-side against profile dimensions on `POST /api/plants`.

**Action photo order:** Create action first (returns `id`), then upload photos sequentially via existing `/api/photos/upload` — reuse F-02 endpoint unchanged.

**Signed URLs:** Extract storage path from stored `photo_url` (or store path separately in a follow-up; for S-02 parse path from URL). Sign in Astro frontmatter when SSR-loading plant card; for client-refreshed images use a short-lived signed URL from server props.

## Phase 1: Backend Foundation

### Overview

Add plant and action CRUD (create + read only), extend weather and storage helpers, expose action types list.

### Changes Required:

#### 1. Grid label helpers

**File**: `src/lib/grid.ts`

**Intent**: Convert between numeric `grid_x`/`grid_y` and human labels like "A3" for display and validation.

**Contract**: Export `formatGridLabel(grid_x, grid_y): string` and `parseGridLabel(label): { grid_x, grid_y } | null`; export `isWithinGardenBounds(grid_x, grid_y, garden_width, garden_height): boolean`.

#### 2. Storage extensions

**File**: `src/lib/storage.ts`

**Intent**: Support plant avatar uploads and signed URL generation for private bucket display.

**Contract**: Add `uploadPlantPhoto(supabase, file, userId, plantId)` storing at `{userId}/plants/{plantId}/{uuid}.{ext}`; add `getSignedPhotoUrl(supabase, storagePath, expiresInSeconds?)` returning a time-limited URL; keep existing `uploadPhoto` for action paths unchanged.

#### 3. Weather by city

**File**: `src/lib/weather.ts`

**Intent**: Fetch historical weather using `profiles.location_city` when lat/lng are unavailable.

**Contract**: Add `fetchWeatherForDateByCity(date: string, cityName: string): Promise<WeatherData | null>` using history API with `q=${encodeURIComponent(cityName)}`; add `getWeatherForDateByCity(date, cityName, supabase)` with cache-first via existing `getCachedWeather`.

#### 4. Plant display name helper

**File**: `src/lib/plants.ts`

**Intent**: Centralize FR-004 display name formatting.

**Contract**: Export `formatPlantDisplayName(name, grid_x, grid_y): string` using `formatGridLabel`.

#### 5. POST /api/plants

**File**: `src/pages/api/plants/index.ts`

**Intent**: Create a plant for the authenticated user with validated grid position.

**Contract**: `POST` accepts JSON `{ name, grid_x, grid_y }` or multipart with optional `file` for plant photo. Zod: name 1–200 chars; grid integers ≥ 0; bounds checked against profile `garden_width`/`garden_height`. Sets `user_id` from session. If file present, upload via `uploadPlantPhoto` and set `photo_url`. Returns `201` `{ success: true, plant: { id, name, grid_x, grid_y, photo_url, display_name } }`. JSON error shape matches `upload.ts` (`ApiError`).

#### 6. GET /api/plants/[id]

**File**: `src/pages/api/plants/[id].ts`

**Intent**: Fetch single plant with actions, photos, and action types for plant card (also usable by tests).

**Contract**: `GET` returns plant row, nested `actions[]` each with `photos[]` and resolved `action_type` (or custom name), ordered by `date` desc. `404` if not found or RLS denies. Sign photo URLs in response or return storage paths for server-side signing — pick one approach and use consistently.

#### 7. GET /api/action-types

**File**: `src/pages/api/action-types/index.ts`

**Intent**: List predefined actions for combobox.

**Contract**: `GET` returns `{ action_types: [{ id, name, icon_emoji }] }` sorted by name.

#### 8. POST /api/actions

**File**: `src/pages/api/actions/index.ts`

**Intent**: Create action on a plant with optional weather snapshot.

**Contract**: `POST` JSON `{ plant_id, action_type_id?, custom_action_name?, date }` — XOR enforced matching DB constraint. Load profile `location_city`; call `getWeatherForDateByCity(date as YYYY-MM-DD, city, supabase)`; insert with `weather_data` or NULL. Returns `201` `{ success: true, action: { id, ... } }`. Validate `plant_id` owned by user via RLS.

#### 9. Middleware protected routes

**File**: `src/middleware.ts`

**Intent**: Require auth for new plant pages and APIs.

**Contract**: Extend `PROTECTED_ROUTES` with `/plants`, `/api/plants`, `/api/actions`, `/api/action-types`.

#### 10. Error codes

**File**: `src/types.ts`

**Intent**: Add domain error codes for plant/action APIs.

**Contract**: Add codes such as `PLANT_NOT_FOUND`, `INVALID_GRID_POSITION`, `VALIDATION_ERROR` if not already present.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- `POST /api/plants` creates row with valid grid; rejects out-of-bounds coordinates
- `POST /api/actions` writes `weather_data` when API key set and city valid; saves with NULL when API unavailable
- Plant photo upload stores file under `{user_id}/plants/{plant_id}/`
- Signed URL loads image in browser for authenticated user

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add Plant Page

### Overview

Build `/plants/new` with React form: name, optional plant photo, drag-and-drop garden grid picker sized from user profile.

### Changes Required:

#### 1. shadcn/ui primitives

**Files**: `src/components/ui/input.tsx`, `label.tsx` (and any dependencies)

**Intent**: Form inputs consistent with auth forms.

**Contract**: Install via `npx shadcn@latest add input label` following project "new-york" variant.

#### 2. GardenGridPicker component

**File**: `src/components/plants/GardenGridPicker.tsx`

**Intent**: Visual grid matching garden dimensions; user drags plant marker to select cell.

**Contract**: Props: `rows`, `cols`, `gridX`, `gridY`, `onChange(gridX, gridY)`. CSS grid of cells; draggable marker snaps to cell on drop; keyboard-accessible fallback (arrow keys or click-to-place minimum). Use `cn()` for classes.

#### 3. AddPlantForm component

**File**: `src/components/plants/AddPlantForm.tsx`

**Intent**: Client form submitting plant create with optional photo.

**Contract**: Fields: name (required), optional file input for plant photo, embedded `GardenGridPicker`. On submit: `POST /api/plants` as multipart if photo else JSON. On success: `window.location.href = /plants/${id}`. Client-side validation mirrors server (name length, grid selected).

#### 4. Add plant page

**File**: `src/pages/plants/new.astro`

**Intent**: Protected page hosting AddPlantForm with profile garden dimensions.

**Contract**: SSR: load profile `garden_width`, `garden_height` for grid sizing; redirect to `/auth/signin` if no user (belt-and-suspenders with middleware). Pass dimensions as props to React island (`client:load`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Grid renders with correct cell count for user's garden size
- Drag-and-drop snaps marker to cell; submitted coordinates match visual position
- Plant without photo creates successfully and redirects to plant card
- Plant with photo shows uploaded image on subsequent plant card (after Phase 3)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Plant Card Page

### Overview

Build `/plants/[id]` showing plant details, action teaser(s), and add-action form with combobox, date picker, and multi-photo upload.

### Changes Required:

#### 1. shadcn/ui combobox + calendar

**Files**: `src/components/ui/command.tsx`, `popover.tsx`, `calendar.tsx` (and dependencies)

**Intent**: Action type combobox and date picker per user decisions.

**Contract**: Install via shadcn CLI; combobox allows selecting predefined type or entering custom text (max 300 chars).

#### 2. ActionTeaser component

**File**: `src/components/plants/ActionTeaser.tsx`

**Intent**: Render single action summary on plant card.

**Contract**: Shows first photo via signed URL, placeholder icon (lucide `ImageOff` or seedling icon) if no photos, action name (emoji + name for predefined; plain text for custom), formatted date, weather line (`temp_max`/`temp_min`, precip) or "Weather unavailable", **Planned** badge when `date > end of today` (local date). Use `LibBadge` or shadcn Badge for planned state.

#### 3. AddActionForm component

**File**: `src/components/plants/AddActionForm.tsx`

**Intent**: Create action then upload photos.

**Contract**: Flow: (1) `POST /api/actions` with plant_id, name fields, date; (2) for each selected file (max 5), `POST /api/photos/upload` with `action_id`. Fetch action types from `GET /api/action-types` on mount. Date picker allows past, today, future. Show upload progress/errors per file. On complete: refresh page or optimistic append teaser.

#### 4. Plant card page

**File**: `src/pages/plants/[id].astro`

**Intent**: SSR plant card with action timeline and add-action CTA.

**Contract**: Load plant + actions + photos + types via Supabase in frontmatter (or `GET /api/plants/[id]`). Display `formatPlantDisplayName`, plant photo if set, list of `ActionTeaser` components, `AddActionForm` island. Empty state when no actions: prominent "Add your first action" messaging. `404` for missing plant.

#### 5. Default plant icon asset

**File**: `public/icons/plant-placeholder.svg` (or lucide-only — no asset if using icon component)

**Intent**: FR-004/FR-011 placeholder when no plant/action photo.

**Contract**: Static asset or inline lucide icon used consistently in teasers.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes

#### Manual Verification:

- Add action with predefined type shows emoji + name in teaser
- Add action with custom name works; no emoji
- Upload 1–5 photos; first appears in teaser
- Action with no photos shows placeholder icon
- Future-dated action shows Planned badge
- Weather appears when API available; "Weather unavailable" when not
- Page loads within 2 seconds locally (PRD NFR spot check)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dashboard, Wiring & Tests

### Overview

Connect onboarding CTA on dashboard, finalize route protection, add API integration tests.

### Changes Required:

#### 1. Dashboard CTA

**File**: `src/pages/dashboard.astro`

**Intent**: Guide new users to add-first-plant flow.

**Contract**: Replace placeholder copy with primary Button/link to `/plants/new` labeled "Add your first plant". Keep sign-out. Optionally query plant count to show CTA only when zero plants (recommended).

#### 2. Integration tests — plants API

**File**: `src/pages/api/plants/index.test.ts`

**Intent**: Automated coverage for plant creation and validation.

**Contract**: Tests (local Supabase + dev server pattern from `upload.test.ts`): authenticated create success, unauthenticated 401, out-of-bounds grid 400, invalid name 400. Use `seedTestData` / extend `test-utils.ts` if needed.

#### 3. Integration tests — actions API

**File**: `src/pages/api/actions/index.test.ts`

**Intent**: Automated coverage for action creation.

**Contract**: Tests: create with `action_type_id`, create with `custom_action_name`, XOR violation 400, foreign plant 404, unauthenticated 401. Weather may be null in test env without API key — assert action row created regardless.

#### 4. Test utilities extension

**File**: `src/lib/test-utils.ts`

**Intent**: Helpers for plant/action test seeding if not already sufficient.

**Contract**: Functions to create plant and fetch action types for tests without duplicating setup boilerplate.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run build` passes
- `npm run test:integration` passes (with local Supabase running)

#### Manual Verification:

- New user: signup → dashboard → CTA → add plant → add action → teaser visible
- Sign-out/sign-in preserves plant data
- No regressions on auth or photo upload flows

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/grid.ts` — format/parse round-trip, bounds validation edge cases (optional but low-cost)

### Integration Tests:

- `POST /api/plants` — auth, validation, success
- `POST /api/actions` — auth, XOR constraint, success
- Existing `upload.test.ts` — no regressions

### Manual Testing Steps:

1. Register new user with city and 5×5m garden
2. Dashboard → Add your first plant
3. Drag marker to cell C2, name "Calendula", upload plant photo
4. On plant card, add action "watering" (predefined), today's date, 2 photos
5. Verify teaser: photo, 💧 watering, date, weather or fallback
6. Add second action with future date — verify Planned badge
7. Add action with custom name, no photos — verify placeholder icon

## Performance Considerations

- SSR plant card with joined query (plant + actions + photos) in one round trip — avoid N+1
- Sign URLs in batch when multiple photos on card
- Weather cache via `getCachedWeather` reduces API calls for same date
- Drag grid: cap rendered cells if garden > 50×50 (profile max 100m) — consider virtualized or scrollable grid wrapper to avoid 10k DOM nodes; document if garden at max size needs scroll container

## Migration Notes

No schema migration required for S-02. Storage RLS uses first path segment = user id — `{user_id}/plants/...` paths work with existing policies.

If plant photo paths need stricter RLS later, add migration — not required for MVP (user id prefix is sufficient).

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD US-01, FR-004–FR-011: `context/foundation/prd.md`
- Core schema plan: `context/changes/core-data-schema/plan-brief.md`
- Photo storage plan: `context/changes/photo-storage-setup/plan.md`
- Weather plan: `context/changes/weather-api-integration/plan.md`
- Extended registration (archived): `context/archive/2026-06-07-extended-registration/plan.md`

## Addendum (2026-06-12, impl-review F1)

**UI simplification accepted:** Phase 3 specified shadcn Command/Popover/Calendar for action type combobox and date picker. Implementation uses native `<select>` and `<input type="date">` in `AddActionForm.tsx`. Manual verification passed; shadcn combobox/calendar deferred to S-03 polish slice.

**SSR data loading accepted:** Plant card page uses `loadPlantCardPageData` in `src/lib/plant-page.ts` (direct Supabase + signed URLs) instead of self-fetching `GET /api/plants/[id]`. Intentional SSR optimization — one round-trip, no self-HTTP. API route retained for tests and external clients.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Backend Foundation

#### Automated

- [x] 1.1 `npm run lint` passes — f29f960
- [x] 1.2 `npm run check` passes — f29f960
- [x] 1.3 `npm run build` passes — f29f960

#### Manual

- [x] 1.4 `POST /api/plants` creates row with valid grid; rejects out-of-bounds coordinates — f29f960
- [x] 1.5 `POST /api/actions` writes weather when available; saves with NULL when not — f29f960
- [x] 1.6 Plant photo upload stores under `{user_id}/plants/{plant_id}/` — f29f960
- [x] 1.7 Signed URL loads image in browser — f29f960

### Phase 2: Add Plant Page

#### Automated

- [x] 2.1 `npm run lint` passes — 080342b
- [x] 2.2 `npm run check` passes — 080342b
- [x] 2.3 `npm run build` passes — 080342b

#### Manual

- [x] 2.4 Grid renders correct cell count for garden dimensions — 080342b
- [x] 2.5 Drag-and-drop snaps to cell; coordinates match visual position — 080342b
- [x] 2.6 Plant without photo creates and redirects to plant card — 080342b
- [x] 2.7 Plant with photo displays on plant card — 080342b

### Phase 3: Plant Card Page

#### Automated

- [x] 3.1 `npm run lint` passes — 7d3cd0c
- [x] 3.2 `npm run check` passes — 7d3cd0c
- [x] 3.3 `npm run build` passes — 7d3cd0c

#### Manual

- [x] 3.4 Predefined action shows emoji + name in teaser — 7d3cd0c
- [x] 3.5 Custom action name works — 7d3cd0c
- [x] 3.6 1–5 photos upload; first shown in teaser — 7d3cd0c
- [x] 3.7 No-photo action shows placeholder icon — 7d3cd0c
- [x] 3.8 Future action shows Planned badge — 7d3cd0c
- [x] 3.9 Weather or "Weather unavailable" in teaser — 7d3cd0c

### Phase 4: Dashboard, Wiring & Tests

#### Automated

- [x] 4.1 `npm run lint` passes — daa9525
- [x] 4.2 `npm run check` passes — daa9525
- [x] 4.3 `npm run build` passes — daa9525
- [x] 4.4 `npm run test:integration` passes — daa9525

#### Manual

- [x] 4.5 Full onboarding flow: signup → dashboard → plant → action → teaser — daa9525
- [x] 4.6 Auth and photo upload regressions checked — daa9525
