---
date: 2026-06-13T12:00:00+02:00
researcher: Cursor Agent
git_commit: 4c91aeafe73420723c7f25c69610687d5ad34d34
branch: garden-map-view
repository: plant_it_app
topic: "Biblioteki i podejście wizualne do garden map view + ulepszenie GardenGridPicker"
tags: [research, codebase, garden-map-view, grid, GardenGridPicker, lucide-react, tooltip, multi-cell]
status: complete
last_updated: 2026-06-13
last_updated_by: Cursor Agent
---

# Research: Biblioteki i podejście wizualne do garden map view

**Date**: 2026-06-13  
**Researcher**: Cursor Agent  
**Git Commit**: `4c91aeafe73420723c7f25c69610687d5ad34d34`  
**Branch**: `garden-map-view`  
**Repository**: plant_it_app

## Research Question

Chciałabym najlepiej mieć do tego jakąś bibliotekę, żeby taki ogród/grid ładnie wyglądał. Dodatkowo: ulepszyć istniejący picker przy dodawaniu rośliny (drag-and-drop), dodać wybór ikony dla rozróżnienia wizualnego, tooltip z nazwą/teaserem po najechaniu, oraz rozważyć wielokomórkowe umieszczanie rośliny (np. paproć od A1 do A4 i B2–B4).

## Summary

**Nie potrzebujesz ciężkiej biblioteki canvas/tile-map.** Najlepszy stosunek „ładność / złożoność / zgodność z projektem” daje **rozszerzenie istniejącego wzorca CSS Grid + Tailwind + lucide-react**, z jedną lekką zależnością UI: **shadcn Tooltip** (Radix) do hover teaserów na mapie.

| Potrzeba | Rekomendacja |
|----------|--------------|
| Ładna mapa ogrodu (S-05) | Wspólny komponent `GardenGrid` — tło siatki CSS + markery roślin (sparse, nie 10k przycisków) |
| Ulepszony picker (S-02 flow) | Ten sam `GardenGrid` w trybie `interactive` — drag marker, wybór ikony |
| Rozróżnienie wizualne | Kolumna `icon` w `plants` + picker z kuratorowanego zestawu **lucide** (już w projekcie) |
| Hover → nazwa/teaser | shadcn `Tooltip` na mapie; na pickerze wystarczy `title` lub ten sam Tooltip |
| Wielokomórkowe grządki | **Poza MVP PRD** — wymaga zmiany modelu danych; rekomendacja: odłożyć lub osobna zmiana po S-05 |

**Unikaj:** Konva, Pixi, Phaser, Leaflet, react-grid-layout — zły model (geo-mapy, gry, drag-dashboard) lub koszt bundle/a11y bez korzyści dla prostego prostokątnego ogrodu.

## Detailed Findings

### Stan obecny w kodzie

#### System współrzędnych (`src/lib/grid.ts`)

- `grid_x` = wiersz (0 = A), `grid_y` = kolumna (0 = 1)
- 1 komórka = 1 metr: `rows = floor(garden_height)`, `cols = floor(garden_width)`
- Etykiety: `formatGridLabel(grid_x, grid_y)` → np. `"A3"`

#### Jedyny wizualny grid: `GardenGridPicker`

```17:23:src/components/plants/GardenGridPicker.tsx
export default function GardenGridPicker({ gardenWidth, gardenHeight, gridX, gridY, onChange }: GardenGridPickerProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(320 / Math.max(cols, rows))));
```

**Co działa:** a11y (`role="grid"`, strzałki), snap pointera, tokeny Tailwind, ikona `Sprout`.

**Słabości wizualne:** brak etykiet osi (A/B/1/2), płaskie obramowania, jeden marker, renderuje **każdą komórkę jako `<button>`** — przy 100×100 m to 10 000 węzłów DOM.

#### Baza danych

```16:25:supabase/migrations/20260604120000_core_data_schema.sql
CREATE TABLE public.plants (
  ...
  grid_x INTEGER NOT NULL CHECK (grid_x >= 0),
  grid_y INTEGER NOT NULL CHECK (grid_y >= 0),
  ...
);
```

- Jedna para współrzędnych na roślinę
- Brak unikalności `(user_id, grid_x, grid_y)` — nakładanie dozwolone
- Brak kolumny na ikonę rośliny

#### Mapa ogrodu (S-05)

**Brak implementacji** w `src/` — tylko `context/changes/garden-map-view/change.md` (status: new). Roadmapa: `/garden-map`, statyczna siatka, klik → karta rośliny, bez drag na mapie.

`fetchPlantListForUser` już pobiera `grid_x`, `grid_y`, ale UI listy dostaje tylko `display_name` — współrzędne są odrzucane przed renderem (`src/lib/plant-page.ts`).

### Ocena bibliotek

#### Rekomendowane (MVP + Twoje wymagania)

| Opcja | Nowe zależności | Bundle (gzip) | Dlaczego |
|-------|-----------------|---------------|----------|
| **CSS Grid + Tailwind — sparse map** | 0 | ~0 KB | Tło siatki przez `repeating-linear-gradient` lub SVG pattern; markery absolutnie pozycjonowane; N roślin zamiast N×M komórek |
| **lucide-react** (już jest) | 0 | ~1 KB/ikona | Kuratorowany zestaw: `Sprout`, `Flower2`, `TreePine`, `Leaf`, `Cherry`, `Carrot`, `Bean`… |
| **shadcn Tooltip** | `@radix-ui/react-tooltip` | ~3–5 KB | Hover z nazwą + mini-teaser (ostatnia akcja); dobra a11y vs canvas |
| **Wspólny `GardenGrid`** | 0 | — | `mode: "picker" \| "map"`; jedna logika `cellSize`, etykiety osi, styling |

#### Opcjonalne (później)

| Opcja | Kiedy | Uwagi |
|-------|-------|-------|
| `@tanstack/react-virtual` (~7 KB) | Pełna siatka komórek przy ogrodzie 50×50+ | Tylko jeśli produkt wymaga klikalnych pustych komórek w każdym miejscu |
| `react-svg-pan-zoom` (~25 KB) | Pinch-zoom na mobile dla dużych ogrodów | Poza PRD Non-Goals na MVP |
| Inline SVG pattern | „Organiczniejszy” wygląd grządek | Zero npm; więcej markupu |

#### Odrzucone

| Biblioteka | Powód odrzucenia |
|------------|------------------|
| **react-konva / Konva** | ~50–80 KB; canvas bez natywnej a11y; sensowne dla gier/edytorów, nie dla „kliknij roślinę” |
| **Pixi / Phaser** | Silniki gier; ogromny bundle |
| **Leaflet / Mapbox** | Współrzędne geograficzne (lat/lng), nie siatka A3 w metrach |
| **react-grid-layout / gridstack** | Drag/resize paneli dashboardu — PRD wyklucza repositioning na mapie |
| **@heroicons/react** | Duplikat lucide |
| **@svgdotjs/svg.js** | Imperatywne API; słaba integracja z React 19 |

### Propozycja architektury wizualnej

```
src/components/plants/
  GardenGrid.tsx          # wspólna siatka (tło, osie, cellSize)
  GardenGridPicker.tsx    # cienki wrapper: mode="picker" + drag + icon picker
  GardenMapView.tsx       # cienki wrapper: mode="map" + linki + tooltips
  PlantIconPicker.tsx     # wybór ikony lucide przy dodawaniu
  plant-icons.ts          # mapowanie nazwa → komponent LucideIcon
```

**Wygląd „ładnego ogrodu” bez assetów 3D:**

1. Tło: `bg-emerald-950/5` lub gradient „gleba” + subtelne linie siatki (`repeating-linear-gradient`)
2. Sticky etykiety: wiersze A, B, C… po lewej; kolumny 1, 2, 3… u góry
3. Markery: okrągłe awatary (`PlantAvatar` z `ActionTeaser.tsx`) lub wybrana ikona lucide w kółku `bg-primary`
4. Hover na mapie: Tooltip z `display_name` + opcjonalnie ostatnia akcja (wymaga rozszerzenia loadera)
5. Zajęte komórki: delikatne `bg-primary/10` pod markerem (opcjonalnie)

**Mapa vs picker — różnice:**

| Aspekt | Picker (`/plants/new`) | Mapa (`/garden-map`) |
|--------|------------------------|----------------------|
| Komórki | Klikalne (wybór pozycji) | Tło tylko wizualne |
| Markery | 1 (przeciągany) | Wiele (link `<a href="/plants/id">`) |
| Drag | Tak (pozycja nowej rośliny) | Nie (PRD Non-Goals) |
| Ikona | Wybór przed zapisem | Zapisana w DB |
| Tooltip | Opcjonalny | Nazwa + teaser |

### Wybór ikony rośliny

**Rekomendacja:** kolumna `icon_name TEXT` (lucide icon name, np. `"flower-2"`) w `plants`, domyślnie `"sprout"`.

- Spójne z `action_types.icon_emoji` — tam emoji, tu lucide (wizualnie różne domeny: akcja vs roślina)
- Picker: rząd 8–12 przycisków-toggle z podglądem ikony (wzorzec jak combobox w `AddActionForm`)
- **Bez nowej biblioteki ikon** — lucide już w `package.json`

### Tooltip / teaser po hover

**Rekomendacja:** `npx shadcn@latest add tooltip` — jedyna sensowna nowa zależność UI.

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

Loader mapy musi wtedy zwracać skrót ostatniej akcji (wzór: `fetchPlantListForUser` już łączy akcje dla listy roślin).

### Wielokomórkowe umieszczanie (grządka A1–A4, B2–B4)

**To wykracza poza obecny PRD i schemat.** FR-014 mówi o „pozycji” rośliny; model ma jedną parę `(grid_x, grid_y)`. Non-Goals nie wymieniają multi-cell explicite, ale S-05 roadmap zakłada „jedna ikona na pozycję”.

#### Opcje modelu danych

| Model | Przykład | Plusy | Minusy |
|-------|----------|-------|--------|
| **A. Status quo** — 1 komórka | Paproć tylko w A1 | Zero migracji | Nie oddaje grządki |
| **B. Bounding box** — `grid_x, grid_y, span_rows, span_cols` | A1, span 4×2 | Proste renderowanie prostokąta | Nie obsługuje L-kształtów (B2–B4 bez A5) |
| **C. Tablica komórek** — `grid_cells JSONB` lub tabela `plant_cells` | `[(0,0),(0,1),…]` | Dowolny kształt | Migracja, walidacja, kolizje, UX picker znacznie trudniejszy |
| **D. Osobna encja „grządka”** | Bed → wiele plants | Semantycznie czyste | Duży scope; nowa domena |

**Rekomendacja dla Plant It MVP:**

1. **S-05 + ulepszony picker:** zostać przy **jednej komórce** (anchor point) — wystarczy do FR-013/014/015 i porównywania lokalizacji „która paproć lepiej rośnie”.
2. **Jeśli multi-cell jest must-have:** osobna zmiana po S-05; start od **opcji B** (bounding box) jeśli wystarczą prostokąty; **opcja C** tylko gdy naprawdę potrzebne kształty L/U.

Picker multi-cell (przyszłość): zaznaczanie prostokąta przez drag na siatce (jak zaznaczenie w arkuszu) — nadal bez Konva, czysty DOM + stan `selection: Set<"x,y">`.

## Code References

- `src/lib/grid.ts:27-60` — formatowanie etykiet, wymiary ogrodu, bounds
- `src/components/plants/GardenGridPicker.tsx:17-163` — obecny picker CSS grid
- `src/components/plants/ActionTeaser.tsx:63-72` — `PlantAvatar` do reużycia na markerach
- `src/lib/plant-page.ts:105-163` — lista roślin pobiera `grid_x/y` ale nie eksponuje do UI
- `src/pages/api/plants/index.ts:121-129` — walidacja pozycji w ogrodzie
- `supabase/migrations/20260604120000_core_data_schema.sql:16-25` — schema `plants`
- `context/foundation/roadmap.md:199-210` — spec S-05
- `context/foundation/prd.md:138-147` — FR-013/014/015
- `context/foundation/prd.md:182` — Non-Goals: brak advanced map / drag na mapie

## Architecture Insights

1. **Sparse rendering** — mapa nie powinna klonować pickera z 10k przyciskami; tło CSS + N markerów.
2. **Wspólny komponent** — `cellSize`, osie i styling w jednym miejscu; picker i mapa to tryby, nie dwa niezależne systemy.
3. **Astro SSR** — wymiary ogrodu + lista roślin w frontmatter strony; React island tylko do interakcji (picker drag, tooltips).
4. **Cloudflare Workers** — render po stronie klienta; liczy się rozmiar JS i hydratacja, nie canvas.
5. **Wzorzec ikon** — projekt już używa lucide wszędzie; emoji tylko dla typów akcji.

## Historical Context (from prior changes)

- `context/changes/first-plant-first-action/plan-brief.md` — S-02: drag-and-drop CSS grid (`GardenGridPicker`); mapa odłożona do S-05
- `context/changes/first-plant-first-action/plan.md` — 1 m = 1 komórka; ryzyko 10k DOM przy 100×100 m
- `context/foundation/roadmap.md:234` — otwarte pytanie #4: CSS grid vs canvas/SVG; **rekomendacja CSS grid**
- `context/foundation/tasks-linear.md` (PLA-12) — acceptance: CSS grid, bez drag na mapie
- Brak wcześniejszych decyzji o bibliotekach mapowych (Leaflet, Konva itd.) w `context/`

## Related Research

- Brak wcześniejszego `research.md` dla `garden-map-view`
- Powiązane: `context/archive/2026-06-13-plant-list-view/plan.md` — lista roślin; mapa jako następny krok

## Open Questions

1. **Multi-cell grządki** — **Rozstrzygnięte:** osobna iteracja **S-06** (`garden-multi-cell`) po S-05; zob. `context/foundation/roadmap.md`.
2. **Teaser w tooltipie** — sama nazwa vs nazwa + ostatnia akcja + miniatura?
3. **Kolizje** — czy dwie rośliny mogą dzielić komórkę, czy walidować unikalność przy zapisie?
4. **Zestaw ikon** — stała lista 10 ikon vs pełny wybór z lucide?
5. **Cap rozmiaru ogrodu w UI** — impl review S-02 zalecał max 50×50 lub virtualizację; nadal nierozstrzygnięte.

## Rekomendacja końcowa (decyzja do planu)

| Warstwa | Wybór |
|---------|--------|
| Renderowanie siatki | **CSS + Tailwind** (bez canvas) |
| Nowe npm (MVP) | **`@radix-ui/react-tooltip`** via shadcn (opcjonalnie `@tanstack/react-virtual` tylko jeśli pełna siatka komórek) |
| Ikony roślin | **lucide-react** + kolumna `icon_name` w DB |
| Struktura kodu | Wydzielić **`GardenGrid`**; picker i mapa jako cienkie wrappery |
| Multi-cell | **S-06** (`garden-multi-cell`) po S-05 — migracja + picker prostokątny (bounding box) jako pierwszy krok |

Następny krok: `/10x-implement garden-map-view` (single-cell); później `/10x-plan garden-multi-cell` gdy S-05 done.
