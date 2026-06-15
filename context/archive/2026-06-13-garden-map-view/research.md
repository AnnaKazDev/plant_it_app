---
date: 2026-06-13T12:00:00+02:00
researcher: Cursor Agent
git_commit: 4c91aeafe73420723c7f25c69610687d5ad34d34
branch: garden-map-view
repository: plant_it_app
topic: "Libraries and visual approach for garden map view + GardenGridPicker improvements"
tags: [research, codebase, garden-map-view, grid, GardenGridPicker, lucide-react, tooltip, multi-cell]
status: complete
last_updated: 2026-06-13
last_updated_by: Cursor Agent
---

# Research: Libraries and visual approach for garden map view

**Date**: 2026-06-13  
**Researcher**: Cursor Agent  
**Git Commit**: `4c91aeafe73420723c7f25c69610687d5ad34d34`  
**Branch**: `garden-map-view`  
**Repository**: plant_it_app

## Research Question

Ideally, there should be a library to make the garden/grid look polished. Additionally: improve the existing picker when adding a plant (drag-and-drop), add icon selection for visual distinction, tooltip with name/teaser on hover, and consider multi-cell plant placement (e.g. a fern from A1 to A4 and B2–B4).

## Summary

**You do not need a heavy canvas/tile-map library.** The best balance of "looks good / complexity / project fit" comes from **extending the existing CSS Grid + Tailwind + lucide-react pattern**, with one lightweight UI dependency: **shadcn Tooltip** (Radix) for hover teasers on the map.

| Need | Recommendation |
|------|----------------|
| Polished garden map (S-05) | Shared `GardenGrid` component — CSS grid background + plant markers (sparse, not 10k buttons) |
| Improved picker (S-02 flow) | Same `GardenGrid` in `interactive` mode — drag marker, icon selection |
| Visual distinction | `icon` column in `plants` + picker from a curated **lucide** set (already in the project) |
| Hover → name/teaser | shadcn `Tooltip` on the map; on the picker, `title` or the same Tooltip is enough |
| Multi-cell beds | **Outside MVP PRD** — requires data model changes; recommendation: defer or separate change after S-05 |

**Avoid:** Konva, Pixi, Phaser, Leaflet, react-grid-layout — wrong model (geo maps, games, drag-dashboard) or bundle/a11y cost without benefits for a simple rectangular garden.

## Detailed Findings

### Current state in the codebase

#### Coordinate system (`src/lib/grid.ts`)

- `grid_x` = row (0 = A), `grid_y` = column (0 = 1)
- 1 cell = 1 meter: `rows = floor(garden_height)`, `cols = floor(garden_width)`
- Labels: `formatGridLabel(grid_x, grid_y)` → e.g. `"A3"`

#### Only visual grid: `GardenGridPicker`

```17:23:src/components/plants/GardenGridPicker.tsx
export default function GardenGridPicker({ gardenWidth, gardenHeight, gridX, gridY, onChange }: GardenGridPickerProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(320 / Math.max(cols, rows))));
```

**What works:** a11y (`role="grid"`, arrow keys), pointer snap, Tailwind tokens, `Sprout` icon.

**Visual weaknesses:** no axis labels (A/B/1/2), flat borders, single marker, renders **every cell as a `<button>`** — at 100×100 m that's 10,000 DOM nodes.

#### Database

```16:25:supabase/migrations/20260604120000_core_data_schema.sql
CREATE TABLE public.plants (
  ...
  grid_x INTEGER NOT NULL CHECK (grid_x >= 0),
  grid_y INTEGER NOT NULL CHECK (grid_y >= 0),
  ...
);
```

- One coordinate pair per plant
- No uniqueness on `(user_id, grid_x, grid_y)` — overlapping is allowed
- No column for plant icon

#### Garden map (S-05)

**Not implemented** in `src/` — only `context/changes/garden-map-view/change.md` (status: new). Roadmap: `/garden-map`, static grid, click → plant card, no drag on the map.

`fetchPlantListForUser` already fetches `grid_x`, `grid_y`, but the list UI only receives `display_name` — coordinates are dropped before render (`src/lib/plant-page.ts`).

### Library evaluation

#### Recommended (MVP + your requirements)

| Option | New dependencies | Bundle (gzip) | Why |
|--------|------------------|---------------|-----|
| **CSS Grid + Tailwind — sparse map** | 0 | ~0 KB | Grid background via `repeating-linear-gradient` or SVG pattern; absolutely positioned markers; N plants instead of N×M cells |
| **lucide-react** (already present) | 0 | ~1 KB/icon | Curated set: `Sprout`, `Flower2`, `TreePine`, `Leaf`, `Cherry`, `Carrot`, `Bean`… |
| **shadcn Tooltip** | `@radix-ui/react-tooltip` | ~3–5 KB | Hover with name + mini-teaser (last action); good a11y vs canvas |
| **Shared `GardenGrid`** | 0 | — | `mode: "picker" \| "map"`; single `cellSize`, axis labels, styling logic |

#### Optional (later)

| Option | When | Notes |
|--------|------|-------|
| `@tanstack/react-virtual` (~7 KB) | Full cell grid for 50×50+ gardens | Only if the product requires clickable empty cells everywhere |
| `react-svg-pan-zoom` (~25 KB) | Pinch-zoom on mobile for large gardens | Outside PRD Non-Goals for MVP |
| Inline SVG pattern | More "organic" bed appearance | Zero npm; more markup |

#### Rejected

| Library | Reason for rejection |
|---------|---------------------|
| **react-konva / Konva** | ~50–80 KB; canvas without native a11y; makes sense for games/editors, not "click a plant" |
| **Pixi / Phaser** | Game engines; huge bundle |
| **Leaflet / Mapbox** | Geographic coordinates (lat/lng), not an A3 grid in meters |
| **react-grid-layout / gridstack** | Dashboard panel drag/resize — PRD excludes repositioning on the map |
| **@heroicons/react** | Duplicate of lucide |
| **@svgdotjs/svg.js** | Imperative API; weak integration with React 19 |

### Proposed visual architecture

```
src/components/plants/
  GardenGrid.tsx          # shared grid (background, axes, cellSize)
  GardenGridPicker.tsx    # thin wrapper: mode="picker" + drag + icon picker
  GardenMapView.tsx       # thin wrapper: mode="map" + links + tooltips
  PlantIconPicker.tsx     # lucide icon selection when adding a plant
  plant-icons.ts          # name → LucideIcon component mapping
```

**"Nice garden" look without 3D assets:**

1. Background: `bg-emerald-950/5` or "soil" gradient + subtle grid lines (`repeating-linear-gradient`)
2. Sticky labels: rows A, B, C… on the left; columns 1, 2, 3… at the top
3. Markers: round avatars (`PlantAvatar` from `ActionTeaser.tsx`) or selected lucide icon in a `bg-primary` circle
4. Hover on map: Tooltip with `display_name` + optional last action (requires loader extension)
5. Occupied cells: subtle `bg-primary/10` under the marker (optional)

**Map vs picker — differences:**

| Aspect | Picker (`/plants/new`) | Map (`/garden-map`) |
|--------|------------------------|---------------------|
| Cells | Clickable (position selection) | Background only |
| Markers | 1 (draggable) | Many (link `<a href="/plants/id">`) |
| Drag | Yes (new plant position) | No (PRD Non-Goals) |
| Icon | Selected before save | Stored in DB |
| Tooltip | Optional | Name + teaser |

### Plant icon selection

**Recommendation:** `icon_name TEXT` column (lucide icon name, e.g. `"flower-2"`) in `plants`, default `"sprout"`.

- Consistent with `action_types.icon_emoji` — emoji there, lucide here (visually different domains: action vs plant)
- Picker: row of 8–12 toggle buttons with icon preview (pattern like combobox in `AddActionForm`)
- **No new icon library** — lucide already in `package.json`

### Tooltip / teaser on hover

**Recommendation:** `npx shadcn@latest add tooltip` — the only sensible new UI dependency.

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <a href={`/plants/${plant.id}`}>...</a>
  </TooltipTrigger>
  <TooltipContent>
    <p className="font-medium">{plant.display_name}</p>
    {plant.last_action_summary && (
      <p className="text-muted-foreground text-xs">{plant.last_action_summary}</p>
    )}
  </TooltipContent>
</Tooltip>
```

The map loader must then return a summary of the last action (pattern: `fetchPlantListForUser` already joins actions for the plant list).

### Multi-cell placement (bed A1–A4, B2–B4)

**This goes beyond the current PRD and schema.** FR-014 refers to plant "position"; the model has a single `(grid_x, grid_y)` pair. Non-Goals do not explicitly list multi-cell, but the S-05 roadmap assumes "one icon per position".

#### Data model options

| Model | Example | Pros | Cons |
|-------|---------|------|------|
| **A. Status quo** — 1 cell | Fern only at A1 | Zero migration | Does not represent a bed |
| **B. Bounding box** — `grid_x, grid_y, span_rows, span_cols` | A1, span 4×2 | Simple rectangle rendering | Does not handle L-shapes (B2–B4 without A5) |
| **C. Cell array** — `grid_cells JSONB` or `plant_cells` table | `[(0,0),(0,1),…]` | Arbitrary shape | Migration, validation, collisions, much harder picker UX |
| **D. Separate "bed" entity** | Bed → many plants | Semantically clean | Large scope; new domain |

**Recommendation for Plant It MVP:**

1. **S-05 + improved picker:** stay with **one cell** (anchor point) — sufficient for FR-013/014/015 and comparing locations ("which fern grows better").
2. **If multi-cell is a must-have:** separate change after S-05; start with **option B** (bounding box) if rectangles are enough; **option C** only when L/U shapes are truly needed.

Multi-cell picker (future): rectangle selection via drag on the grid (like spreadsheet selection) — still without Konva, pure DOM + `selection: Set<"x,y">` state.

## Code References

- `src/lib/grid.ts:27-60` — label formatting, garden dimensions, bounds
- `src/components/plants/GardenGridPicker.tsx:17-163` — current CSS grid picker
- `src/components/plants/ActionTeaser.tsx:63-72` — `PlantAvatar` reusable on markers
- `src/lib/plant-page.ts:105-163` — plant list fetches `grid_x/y` but does not expose to UI
- `src/pages/api/plants/index.ts:121-129` — position validation within garden
- `supabase/migrations/20260604120000_core_data_schema.sql:16-25` — `plants` schema
- `context/foundation/roadmap.md:199-210` — S-05 spec
- `context/foundation/prd.md:138-147` — FR-013/014/015
- `context/foundation/prd.md:182` — Non-Goals: no advanced map / drag on map

## Architecture Insights

1. **Sparse rendering** — the map should not clone the picker with 10k buttons; CSS background + N markers.
2. **Shared component** — `cellSize`, axes, and styling in one place; picker and map are modes, not two independent systems.
3. **Astro SSR** — garden dimensions + plant list in page frontmatter; React island only for interaction (picker drag, tooltips).
4. **Cloudflare Workers** — client-side render; JS size and hydration matter, not canvas.
5. **Icon pattern** — the project already uses lucide everywhere; emoji only for action types.

## Historical Context (from prior changes)

- `context/changes/first-plant-first-action/plan-brief.md` — S-02: drag-and-drop CSS grid (`GardenGridPicker`); map deferred to S-05
- `context/changes/first-plant-first-action/plan.md` — 1 m = 1 cell; 10k DOM risk at 100×100 m
- `context/foundation/roadmap.md:234` — open question #4: CSS grid vs canvas/SVG; **recommendation: CSS grid**
- `context/foundation/tasks-linear.md` (PLA-12) — acceptance: CSS grid, no drag on map
- No prior decisions on map libraries (Leaflet, Konva, etc.) in `context/`

## Related Research

- No prior `research.md` for `garden-map-view`
- Related: `context/archive/2026-06-13-plant-list-view/plan.md` — plant list; map as next step

## Open Questions

1. **Multi-cell beds** — **Resolved:** separate iteration **S-06** (`garden-multi-cell`) after S-05; see `context/foundation/roadmap.md`.
2. **Teaser in tooltip** — name only vs name + last action + thumbnail?
3. **Collisions** — can two plants share a cell, or validate uniqueness on save?
4. **Icon set** — fixed list of 10 icons vs full lucide picker?
5. **Garden size cap in UI** — S-02 impl review recommended max 50×50 or virtualization; still unresolved.

## Final recommendation (decision for the plan)

| Layer | Choice |
|-------|--------|
| Grid rendering | **CSS + Tailwind** (no canvas) |
| New npm (MVP) | **`@radix-ui/react-tooltip`** via shadcn (optionally `@tanstack/react-virtual` only if full cell grid) |
| Plant icons | **lucide-react** + `icon_name` column in DB |
| Code structure | Extract **`GardenGrid`**; picker and map as thin wrappers |
| Multi-cell | **S-06** (`garden-multi-cell`) after S-05 — migration + rectangular picker (bounding box) as first step |

Next step: `/10x-implement garden-map-view` (single-cell); later `/10x-plan garden-multi-cell` when S-05 is done.
