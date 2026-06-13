---
project: Plant It
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-13
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Plant It

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Hobby gardeners lose track of when plants were planted, how they looked at each stage, and what care activities have already been performed. The cost: watering gets forgotten, fertilizing happens twice, and there's no way to see whether a plant is thriving because the visual timeline is trapped in the camera roll and care actions live only in memory. The insight: a gardener wants to _see_ the plant's journey — photo history showing how it changed over time — tied to the actions that shaped that growth.

## North star

**S-02: First plant + first action** — the smallest end-to-end slice whose successful delivery would prove the core product hypothesis (visual story = photo + action + date + weather). Placed as early as prerequisites allow because everything else only matters if this works.

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                                                                                                          | Prerequisites          | PRD refs                                              | Status   |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------- | -------- |
| F-01 | core-data-schema          | (foundation) Core schema landed: plants, actions, photos tables + user profile extension (location, garden dimensions) + RLS policies                         | —                      | FR-003, FR-012                                        | ready    |
| F-02 | photo-storage-setup       | (foundation) Photo storage ready: Supabase Storage bucket, upload API, RLS for private photos, max 5 per action validation                                    | —                      | NFR (privacy), FR-007                                 | ready    |
| F-03 | weather-api-integration   | (foundation) Weather API client wired: fetch historical weather by date + coordinates, error handling                                                         | —                      | FR-009, NFR (weather data)                            | ready    |
| S-01 | extended-registration     | Register with email + password + location (city/coordinates) + garden dimensions (width x height in meters)                                                   | F-01                   | FR-001, FR-012                                        | done     |
| S-02 | first-plant-first-action  | Add plant with photo + name + grid coordinates, add action with photos + date, see plant card with action teaser showing photo + action name + date + weather | F-01, F-02, F-03, S-01 | US-01, FR-004, FR-006, FR-007, FR-009, FR-011, FR-013 | proposed |
| S-03 | multiple-actions-tracking | Add multiple actions (past/today/future dates), see plant card with all action teasers, planned actions show badge/indicator                                  | S-02                   | FR-007, FR-008, FR-009, FR-010                        | done     |
| S-03b | action-notes               | Add optional notes when creating an action, see notes on plant card action teaser                                                                             | S-03                   | FR-007                                                | ready    |
| S-04 | plant-list-view           | Add multiple plants, see plant list with last-action teasers (photo + action + date + weather)                                                                | S-02                   | FR-005, FR-009                                        | done     |
| S-05 | garden-map-view           | See garden map with all plants at their grid locations, click plant on map to open plant card                                                                 | S-02                   | FR-013, FR-014, FR-015                                | proposed |

## Routing structure

File-based routing (Astro `src/pages/`). Auth middleware protects routes listed in `PROTECTED_ROUTES` (see `src/middleware.ts`).

| Path                  | Auth      | Slice      | Purpose                                                                |
| --------------------- | --------- | ---------- | ---------------------------------------------------------------------- |
| `/`                   | public    | baseline   | Landing / welcome page (existing)                                      |
| `/auth/signin`        | public    | baseline   | Sign in form (existing)                                                |
| `/auth/signup`        | public    | S-01       | Extended registration: email + password + location + garden dimensions |
| `/auth/confirm-email` | public    | baseline   | Email confirmation page (existing)                                     |
| `/dashboard`          | protected | baseline   | Post-login entry point (existing)                                      |
| `/plants`             | protected | S-04       | Plant list view with last-action teasers                               |
| `/plants/new`         | protected | S-02       | Add first plant form (photo + name + grid coordinates)                 |
| `/plants/[id]`        | protected | S-02, S-03, S-03b | Plant card: view plant details + action timeline + add new action (+ optional action notes) |
| `/garden-map`         | protected | S-05       | Garden map view with plant positions                                   |

**Navigation flow (MVP):**

- Unauthenticated: `/` → `/auth/signup` (or `/auth/signin`) → `/auth/confirm-email` → `/dashboard`
- Authenticated: `/dashboard` → `/plants` (list) or `/garden-map` → `/plants/[id]` (card)

**API routes (outside file-based routing):**

- `/api/auth/{signin,signup,signout}` — existing auth endpoints
- `/api/plants` — future CRUD (POST /plants, GET /plants, GET /plants/[id], PATCH /plants/[id], DELETE /plants/[id])
- `/api/actions` — future CRUD (POST /actions, GET /actions, PATCH /actions/[id], DELETE /actions/[id])
- `/api/photos/upload` — future photo upload endpoint (Supabase Storage wrapper)

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                                               | Note                                                                     |
| ------ | ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| A      | Foundation & onboarding | `F-01` → `S-01`                                     | Enables user registration with garden setup; joins Stream B at `S-02`    |
| B      | Growth tracking         | `F-02` / `F-03` → `S-02` → `S-03` → `S-03b` / `S-04` / `S-05` | Core product (visual story = photo + weather + actions); north star path |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + Tailwind 4, shadcn/ui (Button, auth forms), routing file-based (src/pages/)
- **Backend / API:** partial — Astro SSR + @astrojs/cloudflare, 3 auth API routes (signin/signup/signout), middleware, no controllers
- **Data:** absent — no ORM/query builder, no migrations/schemas/seeds; only Supabase auth client (@supabase/ssr)
- **Auth:** present — Supabase provider, session handling (cookie-based), route middleware with PROTECTED_ROUTES
- **Deploy / infra:** present — Cloudflare Workers (wrangler.jsonc), GitHub Actions CI/CD (lint + build + deploy on main)
- **Observability:** partial — Cloudflare Workers observability flag only; no app-level logging/error tracking/metrics

## Foundations

### F-01: Core data schema

- **Outcome:** (foundation) Core schema landed: plants table (name, photo_url, user_id, grid_x, grid_y), actions table (plant_id, action_type_id nullable FK, custom_action_name nullable TEXT, date, weather_data, additional_data), action_types table (~30 predefined actions with icons like "watering", "fertilizing", "planted from seed"), photos table (action_id, photo_url, order), user profile extension (location, garden_width, garden_height); RLS policies (user sees only their own data); indexes on foreign keys and user_id.
- **Change ID:** core-data-schema
- **PRD refs:** FR-003 (user sees only their own plants), FR-012 (garden dimensions during registration)
- **Unlocks:** S-01 (extended registration needs user profile fields), S-02 (first plant needs plants/actions/photos tables), S-03, S-04, S-05
- **Prerequisites:** —
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:**
  - Initial ~30 predefined actions list (names + icons). Owner: planning phase. Block: no.
  - Icon pack/strategy for action_types. Owner: planning phase. Block: no (recommend Lucide React or Heroicons).
- **Risk:** Schema design is foundational — getting it wrong means expensive migrations later. Spend extra time on schema review (coordinate system: text like "A3" vs numeric x/y, weather_data JSON structure, action_types table design with nullable FK approach) before implementing.
- **Status:** done

### F-02: Photo storage setup

- **Outcome:** (foundation) Photo storage ready: Supabase Storage bucket created for plant photos, upload/download API helpers in src/lib/, RLS policies (private per user), max 5 photos per action validation at API layer.
- **Change ID:** photo-storage-setup
- **PRD refs:** NFR (photos must be private), FR-007 (max 5 photos per action)
- **Unlocks:** S-02 (add plant with photo, add action with photos), S-03, S-04
- **Prerequisites:** —
- **Parallel with:** F-01, F-03
- **Blockers:** —
- **Unknowns:**
  - Supabase Storage free tier limits vs expected usage (50 GB storage, 2 GB bandwidth/month) — will this suffice for testing + early MVP use? Owner: user (you). Block: no (free tier is generous for solo dev testing; monitor usage, upgrade if needed).
- **Risk:** Storage quotas could be hit during testing if many large images are uploaded. Monitor bucket size, compress images client-side if needed.
- **Status:** ready

### F-03: Weather API integration

- **Outcome:** (foundation) Weather API client wired: service wrapper in src/lib/weather.ts, fetch historical weather (temperature, rain, sun) by date + coordinates, error handling (retry on transient failures, allow saving action without weather if API unavailable).
- **Change ID:** weather-api-integration
- **PRD refs:** FR-009 (action teaser shows weather info), NFR (weather data displayed for historical actions reflects conditions at action date)
- **Unlocks:** S-02 (action teaser with weather), S-03, S-04
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:**
  - Which weather API to use? OpenWeatherMap (free tier 1,000 calls/day), WeatherAPI.com (free tier 1M calls/month), or other? Owner: user. Block: no (recommend WeatherAPI.com for higher free tier; can swap later if needed).
- **Risk:** Weather API rate limits or costs. Check pricing before committing; cache weather data per (date, location) pair to avoid redundant API calls.
- **Status:** ready

## Slices

### S-01: Extended registration with garden setup

- **Outcome:** User can register with email + password + location (city/coordinates) + garden name (optional friendly label) + garden dimensions (width x height in meters). Route: `/auth/signup` (extends existing signup page).
- **Change ID:** extended-registration
- **PRD refs:** FR-001 (user can register and provide location + garden dimensions), FR-012 (provide garden dimensions during registration)
- **Prerequisites:** F-01 (user profile extension fields must exist in schema)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Location input: city name (geocode to coordinates) vs manual lat/lng entry vs map picker? Owner: user. Block: no (recommend city name input with geocoding as simplest UX; can enhance later).
- **Risk:** Geocoding adds external dependency (Google Geocoding API, Mapbox, etc.). If main_goal=speed, start with manual coordinate entry (simpler), add city-name geocoding post-MVP.
- **Status:** done

### S-02: First plant + first action

- **Outcome:** User can add plant with photo + name + grid coordinates (e.g., "A3"), add action with photos (max 5) + action name (from predefined list or typed, max 300 chars) + date (selected from calendar), see plant card with action teaser showing first photo + action name + date + weather info (temperature, rain/sun). Routes: `/plants/new` (add plant form), `/plants/[id]` (plant card with action timeline + add action form).
- **Change ID:** first-plant-first-action
- **PRD refs:** US-01, FR-004 (add plant with name, photo, grid location), FR-006 (see plant card), FR-007 (add action with photos, action name, date), FR-009 (action teaser shows photo, action name, date, weather), FR-011 (placeholder icon if no photo), FR-013 (place plant at grid coordinates when adding)
- **Prerequisites:** F-01 (plants/actions/photos schema), F-02 (photo upload), F-03 (weather fetch), S-01 (user has garden dimensions + location for weather)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Grid coordinate input: dropdown (A-Z rows, 1-N cols) vs text field ("A3") vs click-on-map? Owner: user. Block: no (recommend text field "A3" for simplicity; validate format, show grid preview if time allows).
  - Predefined action list (~30 actions): see F-01 for schema decision (action_types table). Action examples: "watering", "fertilizing", "pruning", "planted from seed", "transplanting", "removing diseased leaves", etc. Full list to be defined during F-01 planning.
- **Risk:** Most complex slice — touches all layers (data, API, UI, storage, external weather API). Could expand scope during planning. Keep tightly scoped: single plant, single action, no editing yet. Split into smaller changes if `/10x-plan` reveals hidden complexity.
- **Status:** proposed

### S-03: Track multiple actions per plant

- **Outcome:** User can add multiple actions to a plant (past/today/future dates), see plant card with all action teasers in chronological order, planned actions (future dates) show visual indicator (badge/count) in plant list. Route: `/plants/[id]` (extends plant card from S-02 to show action timeline + repeated "add action" flow).
- **Change ID:** multiple-actions-tracking
- **PRD refs:** FR-007 (add action), FR-008 (choose any date — past, today, or future), FR-009 (action teaser), FR-010 (planned actions show badge/count)
- **Prerequisites:** S-02 (single plant + single action must work first)
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Chronological ordering of actions + distinguishing planned (future) vs historical (past) actions requires date logic. Ensure timezone handling is correct (user's garden location timezone vs server timezone).
- **Status:** done

### S-03b: Action notes on plant actions

- **Outcome:** User can add optional free-text notes when creating an action (e.g. fertilizer amount, observations), and see notes on the plant card action teaser when present. Route: `/plants/[id]` (extends add-action form + `ActionTeaser` from S-02/S-03). Uses existing `actions.additional_data` column — no schema migration.
- **Change ID:** action-notes
- **PRD refs:** FR-007 (add action — shape notes / user journey mention “additional text”)
- **Prerequisites:** S-03 (multi-action plant card flow)
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low scope — deferred from S-02 (`additional_data` column existed without UI). Keep optional; max length enforced at API (e.g. 1000 chars).
- **Status:** ready

### S-04: Plant list view with multiple plants

- **Outcome:** User can add multiple plants, see plant list with last-action teasers (photo + action + date + weather), teasers show planned-action badge if plant has future actions. Route: `/plants` (main plant list view, likely linked from `/dashboard`).
- **Change ID:** plant-list-view
- **PRD refs:** FR-005 (see list of all plants with last-action teasers), FR-009 (teaser shows photo, action name, date, weather)
- **Prerequisites:** S-02 (single plant must work first)
- **Parallel with:** S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** List performance with many plants (10+). If each plant loads last action + weather + photo separately, this could be slow. Ensure one query fetches all plants + their last actions in bulk. PRD NFR says "list loads within 2 seconds".
- **Status:** done

### S-05: Garden map view with spatial layout

- **Outcome:** User can see garden map with all plants positioned at their grid locations (visual grid matching garden dimensions from S-01), click plant icon on map to open that plant's card. Route: `/garden-map` (separate view, likely linked from `/dashboard` or `/plants`).
- **Change ID:** garden-map-view
- **PRD refs:** FR-013 (place plant at grid coordinates — input part done in S-02, visualization here), FR-014 (see garden map with all plants), FR-015 (click plant on map → open plant card)
- **Prerequisites:** S-02 (plants must have grid coordinates)
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Map visualization approach: HTML canvas / SVG / CSS grid? Owner: user. Block: no (recommend CSS grid for simplicity — fastest to implement, accessible, responsive; canvas/SVG are overkill for rectangular grid).
- **Risk:** Garden map could become complex (drag-and-drop plant repositioning, zoom, pan). PRD Non-Goals explicitly defers advanced map features. Keep it simple: static grid, click to navigate, no dragging. Defer enhancements.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------- | ---------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| F-01       | core-data-schema          | Database schema: plants, actions, photos, user profile extension + RLS | yes                   | Run `/10x-plan core-data-schema`        |
| F-02       | photo-storage-setup       | Photo storage: Supabase Storage bucket + upload API + RLS              | yes                   | Run `/10x-plan photo-storage-setup`     |
| F-03       | weather-api-integration   | Weather API integration: historical fetch by date + coordinates        | yes                   | Run `/10x-plan weather-api-integration` |
| S-01       | extended-registration     | Extended registration: location + garden dimensions                    | no                    | Blocked on F-01                         |
| S-02       | first-plant-first-action  | Add first plant + first action with weather                            | no                    | Blocked on F-01, F-02, F-03, S-01       |
| S-03       | multiple-actions-tracking | Track multiple actions per plant (past/future dates)                   | no                    | Blocked on S-02                         |
| S-03b      | action-notes              | Optional notes on actions (create + teaser display)                    | yes                   | Run `/10x-implement action-notes`       |
| S-04       | plant-list-view           | Plant list view with last-action teasers                               | no                    | Blocked on S-02                         |
| S-05       | garden-map-view           | Garden map view with plant positions                                   | no                    | Blocked on S-02                         |

## Open Roadmap Questions

1. **Weather API selection** — Which weather service? OpenWeatherMap (free tier 1,000 calls/day), WeatherAPI.com (free tier 1M calls/month), or other? Owner: user. Block: F-03 (recommend WeatherAPI.com for higher free tier; proceed with that default unless you prefer another).

2. **Location input UX** — City name (with geocoding) vs manual lat/lng entry vs map picker? Owner: user. Block: S-01 (recommend city name input if geocoding service is acceptable; manual coordinates if keeping dependencies minimal).

3. **Grid coordinate input UX** — Dropdown (A-Z rows, 1-N cols) vs text field ("A3") vs click-on-map preview? Owner: user. Block: S-02 (recommend text field "A3" for MVP speed; enhance with visual grid later).

4. **Map visualization approach** — HTML canvas / SVG / CSS grid for garden map? Owner: user. Block: S-05 (recommend CSS grid — fastest to implement, accessible, responsive; canvas/SVG are overkill for rectangular grid).

## Parked

- **FR-016 (search by plant name, action type)** — Why parked: nice-to-have; main_goal=speed + top_blocker=time. Basic plant list view is sufficient for MVP with 10-20 plants. Search deferred to post-MVP.

- **Push notifications for planned actions** — Why parked: PRD §Non-Goals. Notification infrastructure adds complexity; for 3-week MVP with after-hours work, manual checking is sufficient.

- **Sharing gardens between users** — Why parked: PRD §Non-Goals. Strictly single-user in MVP. No multi-user access, no shared gardens, no collaboration features.

- **Advanced map features** — Why parked: PRD §Non-Goals. MVP uses simple rectangular grid (width x height in meters). Non-rectangular garden shapes, custom boundaries, drag-and-drop plant positioning, sunlight zone mapping, and freeform drawing are deferred.

- **Full account deletion** — Why parked: PRD §Non-Goals. Users can delete individual plants or actions, but full account deletion with data purge is out of MVP scope (data retention policy + GDPR-compliant deletion add legal/technical complexity beyond 3-week timeline).

## Done

- **S-01: User can register with email + password + location (city/coordinates) + garden name (optional friendly label) + garden dimensions (width x height in meters). Route: `/auth/signup` (extends existing signup page).** — Archived 2026-06-10 → `context/archive/2026-06-07-extended-registration/`. Lesson: —.
- **S-03: User can add multiple actions to a plant (past/today/future dates), see plant card with all action teasers in chronological order, planned actions (future dates) show visual indicator (badge/count) in plant list. Route: `/plants/[id]` (extends plant card from S-02 to show action timeline + repeated "add action" flow).** — Archived 2026-06-12 → `context/archive/2026-06-12-multiple-actions-tracking/`. Lesson: —.
- **S-04: User can add multiple plants, see plant list with last-action teasers (photo + action + date + weather), teasers show planned-action badge if plant has future actions. Route: `/plants` (main plant list view, likely linked from `/dashboard`).** — Archived 2026-06-13 → `context/archive/2026-06-13-plant-list-view/`. Lesson: —.
