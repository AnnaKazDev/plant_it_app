# Garden Map View — Plan Brief

> Full plan: `context/changes/garden-map-view/plan.md`
> Research: `context/changes/garden-map-view/research.md`

## What & Why

Deliver roadmap slice S-05 (FR-014, FR-015): Anna opens a garden map and sees every plant on a visual grid matching her garden dimensions, hovers for context, and clicks through to the plant card — completing the PRD spatial story. The same slice upgrades the add-plant grid picker (shared `GardenGrid`, ~20 lucide icons, nicer styling) so placement and map look consistent.

## Starting Point

S-02/S-04 built plant create, list, and card flows. `GardenGridPicker` exists but renders a flat per-cell button grid; `fetchPlantListForUser` already loads `grid_x`/`grid_y` but drops them from list UI. No `/garden-map` route, no `icon_name` column, no Tooltip component. Multi-cell grządki are roadmap **S-06**, not this slice.

## Desired End State

User opens `/garden-map` from dashboard or plant list → styled grid with axis labels and plant icon markers at grid positions. Hover shows display name + last action + photo thumbnail. Click opens `/plants/[id]`. Overlapping plants in one cell both remain visible (offset stack). On `/plants/new`, user picks from ~20 plant icons and uses the upgraded sparse grid picker. `POST /api/plants` persists `icon_name`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Rendering | CSS + Tailwind sparse grid | Best polish per KB; no canvas; matches research | Research |
| Tooltip library | shadcn Tooltip (Radix) | Rich hover with a11y; ~3–5 KB | Research |
| Tooltip content | Name + last action + photo | User choice for maximum context on hover | Plan |
| Plant icons | `icon_name` column + ~20 curated lucide | Visual distinction without new icon npm package | Research / Plan |
| Picker in scope | Full `GardenGrid` refactor + icon picker | User wants consistent improved UX in same PR | Plan |
| Cell collisions | Allow overlap; offset markers on map | Matches current DB (no unique constraint) | Plan |
| Multi-cell beds | Deferred to S-06 | Schema + UX too large for S-05 | Research / Roadmap |
| Map marker | Lucide icon on grid; photo in tooltip only | Keeps map readable; photo in tooltip per user | Plan |
| Data loading | SSR `loadGardenMapPageData` | Matches plant list/card pattern; no new GET route | Plan |

## Scope

**In scope:**

- Migration `plants.icon_name` (default `sprout`)
- `src/lib/plant-icons.ts`, `PlantIconPicker`, `GardenGrid`, refactored `GardenGridPicker`
- `GardenMapView`, `/garden-map`, middleware protection
- `fetchGardenMapPlantsForUser` + loader with last-action data for tooltips
- shadcn Tooltip; dashboard + plant list links
- `POST /api/plants` `icon_name` validation; integration tests

**Out of scope:**

- S-06 multi-cell placement
- Map drag-reposition, pan/zoom
- Edit icon/position after create
- `GET /api/garden-map` endpoint
- UI automation tests

## Architecture / Approach

Migration adds `icon_name`. Shared bulk fetch (plants + actions) powers map tooltips. `GardenGrid` renders axis labels and CSS grid background; map overlays N icon markers with collision offsets; picker uses same grid with sparse click/drag. Astro SSR loads data; React island hydrates map tooltips and picker interactivity.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + API | `icon_name` migration, allowlist, POST + map fetcher | Types lint after `gen types` |
| 2. GardenGrid + picker | Shared grid, icon picker, sparse picker refactor | Picker a11y after removing per-cell buttons |
| 3. Map UI | `/garden-map`, tooltips, collision offsets | Tooltip on mobile / touch |
| 4. Nav + tests | Dashboard/list links, integration tests, CI | Test seed compatibility with new column |

**Prerequisites:** S-02/S-04 complete; local Supabase for integration tests  
**Estimated effort:** ~3–4 implementation sessions across 4 phases

## Open Risks & Assumptions

- Radix Tooltip is hover-primary; `aria-label` on markers must carry essential info for keyboard/touch
- Very large gardens (100×100) still scroll — sparse picker/map avoid 10k DOM but scroll UX may feel tight
- No unique grid cell constraint — intentional; map must handle overlaps gracefully

## Success Criteria (Summary)

- User sees all plants on `/garden-map`, hovers for rich tooltip, clicks to plant card
- Add-plant flow supports icon pick + upgraded grid
- `POST /api/plants` icon tests pass; lint, check, build clean
