---
title: "Plant It — Invariant Aggregate Refactor Plan"
created: 2026-07-26
type: refactor-plan
sources:
  - context/domain/01-domain-distillation.md
  - context/foundation/prd.md
  - context/foundation/roadmap.md
  - context/foundation/tech-stack.md
  - context/foundation/test-plan.md
  - context/archive/2026-06-13-garden-map-view/plan.md
  - src/** (verified citations)
---

# Invariant Aggregate Refactor: Unique Cell Occupancy

Plan zabezpieczenia wybranego niezmiennika domenowego. **Nie jest implementacją** — opisuje odkrycie, diagnozę i projekt agregatu-strażnika.

Decyzja produktowa w tym planie: **PRD jest kanonem** (`FR-014`, success criteria). Świadoma decyzja implementacyjna S-05 („allow overlaps”) jest traktowana jako **naruszanie niezmiennika**, nie jako nowa reguła domenowa.

---

## KROK 0 — Kontekst

### Źródła wymagań

| Dokument | Rola dla niezmienników |
| --- | --- |
| `context/foundation/prd.md` | Vision, Primary Success Criteria, FR/NFR, Business Logic, Guardrails |
| `context/foundation/roadmap.md` | S-05 outcome (multi-plant/cell); S-06 unknown „collision rules” |
| `context/foundation/tech-stack.md` | Astro + React + TS + Supabase + Cloudflare — brak warstwy domenowej |
| `context/foundation/test-plan.md` | Vitest integration; risk #5 last-action; brak ryzyka cell occupancy |
| `context/domain/01-domain-distillation.md` | Mapa pojęć, ranking kandydatów |
| `README.md` / `AGENTS.md` | Operacyjne (storage, max 5 photos); potwierdzają brak wydzielonej domeny |

### Stack i warstwy logiki biznesowej

| Warstwa | Lokalizacja | Jak żyją reguły dziś |
| --- | --- | --- |
| UI (React islands) | `src/components/plants/` | Layout multi-occupancy, picker pozwala na zajętą komórkę |
| API (HTTP) | `src/pages/api/plants/`, `actions/`, `photos/` | Zod + ad-hoc if; brak checków occupancy |
| Helpers („serwis”) | `src/lib/` (`grid`, `garden-markers`, `plant-page`, `weather`, …) | Anemiczne funkcje; reguły rozproszone |
| Domena | **BRAK** | Brak agregatów / named domain errors |
| Persystencja | `supabase/migrations/` | CHECK / UNIQUE / RLS; **brak** UNIQUE na `(user_id, grid_x, grid_y)` |

**Wizja (kotwica wyboru):** „The story is the product” — photo + action + date — **oraz** przestrzenna oś: „track which location produces better growth” (`prd.md:24`, `prd.md:52`).

---

## KROK 1 — Identyfikacja niezmienników biznesowych

Reguły, które w tej domenie **MUSZĄ** być zawsze prawdziwe. Źródła: dokumenty + kod.

| # | Niezmiennik | Źródło wymagań | Dowód w kodzie / DB |
| --- | --- | --- | --- |
| I1 | **Każda roślina użytkownika zajmuje inną komórkę siatki** `(user_id, grid_x, grid_y)` | FR-014 `prd.md:142`; success 9/13/15 `prd.md:46,50,52` | **Naruszany** — brak UNIQUE `core_data_schema.sql:16-25`; UI fan `garden-markers.ts:1-6,48-78,96-98`; plan S-05 świadomie pozwala `…/garden-map-view/plan.md:55` |
| I2 | Pozycja rośliny mieści się w wymiarach ogrodu | FR-012/013 `prd.md:134,138` | **Egzekwowany w API** — `plants/index.ts:125-134` + `grid.ts:57-59`; DB tylko `grid_* >= 0` `core_data_schema.sql:21-22` |
| I3 | Display name = `{name} ({gridLabel})` | FR-004 `prd.md:100` | **Read-model** — `plants.ts:5-7` (nie persystowany) |
| I4 | Plant należy tylko do właściciela | FR-003 `prd.md:95` | **Egzekwowany** — RLS `core_data_schema.sql:82-85` |
| I5 | XOR: `action_type_id` XOR `custom_action_name` | FR-007 `prd.md:113` | **Egzekwowany** — CHECK `core_data_schema.sql:46-49` + zod |
| I6 | Custom action name ≤ 300 znaków | FR-007 `prd.md:113` | **Egzekwowany** — DB + zod |
| I7 | Max 5 photos per action | Guardrail `prd.md:64` | **Tylko API** — `photos/upload.ts:11,131-141`; brak constraintu DB; race możliwy |
| I8 | Data akcji: past / today / future dozwolone | FR-008 `prd.md:117` | **Dopuszczony** — brak ograniczenia; planned = future `action-dates.ts:11-16` |
| I9 | „Last action” na liście = ostatnia **wykonana** (nie przyszła) | FR-005 / success 11 `prd.md:104,48`; test-plan risk #5 | **Słaby** — sort max(date) `plant-page.ts:181-185` + `action-dates.ts:18-19` |
| I10 | Weather: fail → jasny błąd + retry **lub** save without | NFR `prd.md:159` | **Naruszany (ciche null)** — `weather.ts:106-109` return null; `actions/index.ts:92-107` zapisuje null + 201 |
| I11 | Zdjęcia prywatne — tylko właściciel | Guardrail `prd.md:62`; NFR `prd.md:160` | **Egzekwowany** — storage RLS |
| I12 | Wymiary ogrodu > 0; rejestracja z lokalizacją | FR-001/012 | **Egzekwowany** — DB CHECK + signup zod |

---

## KROK 2 — Klasyfikacja i wybór #1

### Macierz (a) rdzeniowość × (b) rozsmarowanie × (c) egzekucja

Skala egzekucji: **E** = egzekwowany, **D** = deklarowany, **N** = naruszalny / odwrócony.

| # | Rdzeń wizji / success (a) | Warstwy / pliki (b) | Egzekucja (c) | Score „core ∧ weak” |
| --- | --- | --- | --- | --- |
| **I1 unique cell** | **Bardzo wysoki** — FR-014 must-have; success 9, 13, 15; insight lokalizacji wzrostu | UI + helpers + API (brak) + DB (brak) + archive plan (przeciw) | **N — aktywnie odwrócony** | **#1** |
| I9 last-action | Wysoki — codzienny ekran po loginie | `plant-page` + teaser UI | D/N — myląca semantyka | #2 |
| I10 weather policy | Wysoki (Supporting essential do story) | weather service + actions API + UI | N — fail swallow | #3 |
| I7 photo quota | Średni-wysoki (guardrail) | API only | E w API, N w race/DB | #4 |
| I2 bounds | Wysoki (wejście do mapy) | API + grid helper | E w API | — |
| I5/I6 XOR + length | Średni (poprawność akcji) | API + DB | E | — |
| I4/I11 ownership | Wysoki (guardrail) | RLS + middleware | E | — |

### Wybór #1: **Unique cell occupancy** (I1)

**Uzasadnienie:**

1. **Rdzeniowy:** bez unikalnej lokalizacji success krok 15 („third plant Sunflower in *different* garden location, track which location produces better growth” — `prd.md:52`) traci sens; FR-014 mówi wprost: „Each plant should have different location on a map” (`prd.md:142`).
2. **Najsłabiej egzekwowany:** nie jest „dziurą w walidacji” — kod **świadomie obsługuje kolizje** (fan layout, picker offset, archive plan „Blocking duplicate grid cells — user chose allow overlaps”). To jedyny Core niezmiennik **aktywnie zaprzeczony** przez implementację.
3. **Vs I9/I10:** psują odczyt story, ale nie negują wprost must-have FR przestrzennego. I1 jest wcześniejszym konfliktem model↔kod (patrz też `01-domain-distillation.md` ranking).

**Decyzja projektowa tego planu:** egzekwować I1 jako twardy niezmiennik. Alternatywa (oficjalnie zmienić PRD na multi-plant-per-cell) jest **odrzutem** tego planu — wymagałaby osobnej zmiany wymagań, nie agregatu-strażnika FR-014.

---

## KROK 3 — Diagnoza I1 (gdzie żyje reguła dziś)

### Mapa egzekucji (stan AS-IS)

```
PRD FR-014: "different location"     ← deklaracja
        │
        ▼
┌───────────────────┐
│  UI picker/map    │  ← JEDYNY „strażnik”… ale ODWRÓCONY:
│  garden-markers   │     pozwala i renderuje multi-occupancy
└─────────┬─────────┘
          │ POST { grid_x, grid_y }
          ▼
┌───────────────────┐
│  API plants POST  │  ← sprawdza bounds (I2), NIE occupancy (I1)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  plants table     │  ← brak UNIQUE(user_id, grid_x, grid_y)
└───────────────────┘
```

### Cytaty warstwa po warstwie

#### 1. Wymagania (deklaracja)

```142:142:context/foundation/prd.md
- FR-014: User can see a garden map view showing all plants positioned at their garden locations. Each plant should have different location on a map. Priority: must-have
```

```46:52:context/foundation/prd.md
9. Add second plant: "Sunflower" with img, name, and place it on garden map in different location.
...
13. See both plants positioned on map grid (Calendula and Sunflower in different locations)
...
15. Later, add third plant "Sunflower" in different garden location, track which location produces better growth.
```

#### 2. Persystencja — **nie egzekwuje**

```16:25:supabase/migrations/20260604120000_core_data_schema.sql
CREATE TABLE public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 200),
  photo_url TEXT,
  grid_x INTEGER NOT NULL CHECK (grid_x >= 0),
  grid_y INTEGER NOT NULL CHECK (grid_y >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Brak `UNIQUE (user_id, grid_x, grid_y)`. Index tylko `idx_plants_user_id` (linia 63).

#### 3. API — egzekwuje bounds, **nie** occupancy

```125:160:src/pages/api/plants/index.ts
  if (!isWithinGardenBounds(gridX, gridY, profile.garden_width, profile.garden_height)) {
    return jsonError(
      {
        code: ERROR_CODES.INVALID_GRID_POSITION,
        message: "Grid position is outside garden bounds",
        details: { grid_x: gridX, grid_y: gridY },
      },
      400,
    );
  }
  // … brak sprawdzenia zajętości komórki …
  const { data: plant, error: insertError } = await supabase
    .from("plants")
    .insert({
      user_id: context.locals.user.id,
      name,
      grid_x: gridX,
      grid_y: gridY,
      icon_name: iconName,
    })
```

`ERROR_CODES` ma `INVALID_GRID_POSITION`, **nie** ma kodu zajętej komórki (`src/types.ts:65-82`).

Testy API pokrywają out-of-bounds (`plants/index.test.ts:149-168`), **nie** kolizję komórki.

#### 4. Helpers UI — **odwracają** niezmiennik (layout multi-occupancy)

```1:6:src/lib/garden-markers.ts
export const CELL_FAN_POSITIONS = [
  { dx: 0.12, dy: 0.12 },
  { dx: 0.52, dy: 0.12 },
  { dx: 0.12, dy: 0.52 },
  { dx: 0.52, dy: 0.52 },
] as const;
```

```48:78:src/lib/garden-markers.ts
export function groupPlantsByCell<T extends GridPositionedPlant>(plants: T[]): Map<string, T[]> {
  // … grupuje wiele roślin na klucz grid_x-grid_y …
}
export function buildMarkerLayouts<T extends GridPositionedPlant>(…) {
  // … dla count > 1 stosuje sub-cell offsets …
}
```

```96:98:src/lib/garden-markers.ts
export function countPlantsAtCell(plants: GridPositionedPlant[], gridX: number, gridY: number): number {
  return plants.filter((plant) => plant.grid_x === gridX && plant.grid_y === gridY).length;
}
```

Użycie na mapie: `GardenPlantMarkers.tsx:27` → `buildMarkerLayouts`.

#### 5. UI picker — klient **nie blokuje** zajętej komórki (jest jedynym miejscem „świadomym” kolizji — i je akceptuje)

```47:48:src/components/plants/GardenGridPicker.tsx
  const existingAtCell = countPlantsAtCell(existingPlants, gridX, gridY);
  const newPlantLayout = getNewPlantMarkerLayout(gridX, gridY, existingAtCell, cellSize);
```

`onChange` / `snapPointerToGridCell` (`GardenGridPicker.tsx:55-58`) ustawia komórkę bez sprawdzenia zajętości. `AddPlantForm` wysyła `grid_x`/`grid_y` bez walidacji occupancy.

#### 6. Świadoma decyzja przeciw PRD (dług dokumentacyjny)

```55:55:context/archive/2026-06-13-garden-map-view/plan.md
- **Blocking duplicate grid cells** — user chose allow overlaps with visual stack
```

```232:232:context/foundation/roadmap.md
  - Cell collision rules: allow overlap between plants or enforce unique occupancy per cell. Owner: user. Block: no.
```

### Podsumowanie luk

| Warstwa | Status I1 |
| --- | --- |
| PRD | Deklaruje unikalność |
| DB | Nie egzekwuje |
| API / serwis domenowy | Nie egzekwuje (tylko bounds) |
| UI | Jedyny „strażnik” — **odwraca** regułę (fan + allow drop) |
| Fail-fast | Brak — kolizja jest cicho akceptowana (201 + offset) |
| Połykanie błędu | N/A dla I1 (nie ma błędu); wzorzec „log+continue” występuje przy I10 weather (`weather.ts:106-109`) |

---

## KROK 4 — Projekt agregatu-strażnika

### Dlaczego root = **Garden**, nie Plant

Niezmiennik dotyczy **zbioru** pozycji w ogrodzie użytkownika: „w ogrodzie O żadne dwie żywe rośliny nie dzielą komórki”. Pojedynczy `Plant` nie widzi sąsiadów — egzekucja na encji Plant bez kolekcji byłaby znowu rozsmarowanym SELECT-em w API.

```
Garden (aggregate root)
  ├── dimensions: { width, height }   // z profiles
  ├── plants: PlantPlacement[]        // id, name, gridX, gridY, iconName, …
  └── invariants:
        • każda placement.grid ∈ bounds(dimensions)
        • unikalność (gridX, gridY) w plants
```

`Plant` pozostaje encją wewnątrz agregatu (identity = UUID). Identity ogrodu w MVP = `user_id` (1:1 z profilem).

### Błędy domenowe (fail-fast, nazwane)

```ts
// src/lib/domain/garden-errors.ts  (propozycja ścieżki)

export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class CellOccupiedError extends DomainError {
  constructor(
    readonly gridX: number,
    readonly gridY: number,
    readonly occupyingPlantId: string,
  ) {
    super("CELL_OCCUPIED", `Grid cell (${gridX}, ${gridY}) is already occupied`);
  }
}

export class OutOfGardenBoundsError extends DomainError {
  constructor(readonly gridX: number, readonly gridY: number) {
    super("INVALID_GRID_POSITION", `Grid position (${gridX}, ${gridY}) is outside garden bounds`);
  }
}
```

Mapowanie HTTP: `CELL_OCCUPIED` → **409 Conflict** (lub 400 spójne z istniejącym stylem API — preferuj **409**, bo stan konfliktu zasobów). `INVALID_GRID_POSITION` → 400 (jak dziś).

Nowy kod w `ERROR_CODES`: `CELL_OCCUPIED: "CELL_OCCUPIED"`.

### Metody domenowe — sygnatury + pseudokod

```ts
type GridPosition = { gridX: number; gridY: number };

type PlacePlantCommand = {
  name: string;           // 1..200
  position: GridPosition;
  iconName: string;       // allowlist
};

type PlantPlacement = {
  id: string;             // assigned on place (uuid) lub przez repo przy save
  name: string;
  gridX: number;
  gridY: number;
  iconName: string;
};

class Garden {
  constructor(
    readonly ownerId: string,
    readonly width: number,
    readonly height: number,
    private plants: PlantPlacement[],
  ) {}

  /** Jedyna legalna droga dodania rośliny do ogrodu. */
  placePlant(cmd: PlacePlantCommand): PlantPlacement {
    // precondition: bounds
    if (!isWithinGardenBounds(cmd.position.gridX, cmd.position.gridY, this.width, this.height)) {
      throw new OutOfGardenBoundsError(cmd.position.gridX, cmd.position.gridY);
    }

    // invariant I1 — fail-fast
    const occupant = this.plants.find(
      (p) => p.gridX === cmd.position.gridX && p.gridY === cmd.position.gridY,
    );
    if (occupant) {
      throw new CellOccupiedError(cmd.position.gridX, cmd.position.gridY, occupant.id);
    }

    // precondition: name
    if (!cmd.name || cmd.name.length > 200) {
      throw new DomainError("VALIDATION_ERROR", "Invalid plant name");
    }

    const plant: PlantPlacement = {
      id: crypto.randomUUID(), // lub defer do repo
      name: cmd.name,
      gridX: cmd.position.gridX,
      gridY: cmd.position.gridY,
      iconName: cmd.iconName,
    };

    this.plants.push(plant);
    return plant;
  }

  /** Na przyszłość (dziś brak PATCH pozycji) — ten sam niezmiennik. */
  movePlant(plantId: string, to: GridPosition): void {
    const plant = this.plants.find((p) => p.id === plantId);
    if (!plant) throw new DomainError("PLANT_NOT_FOUND", "Plant not found");

    if (!isWithinGardenBounds(to.gridX, to.gridY, this.width, this.height)) {
      throw new OutOfGardenBoundsError(to.gridX, to.gridY);
    }

    const occupant = this.plants.find(
      (p) => p.id !== plantId && p.gridX === to.gridX && p.gridY === to.gridY,
    );
    if (occupant) {
      throw new CellOccupiedError(to.gridX, to.gridY, occupant.id);
    }

    plant.gridX = to.gridX;
    plant.gridY = to.gridY;
  }

  /** Query dla UI — zajęte komórki (bez layoutu fan). */
  occupiedCells(): ReadonlySet<string> {
    return new Set(this.plants.map((p) => `${p.gridX}-${p.gridY}`));
  }
}
```

Zasada: **żadna ścieżka** nie mutuje `plants.grid_*` poza `Garden.placePlant` / `Garden.movePlant`.

### Repozytorium + atomowość

```ts
interface GardenRepository {
  /** Ładuje dimensions z profiles + wszystkie plants użytkownika (pozycje). */
  loadByOwnerId(ownerId: string): Promise<Garden | null>;

  /**
   * Persystuje nową placement z agregatu.
   * Atomowość I1: UNIQUE constraint jako ostateczny strażnik przy race.
   */
  insertPlant(garden: Garden, plant: PlantPlacement): Promise<void>;
}
```

**Jedna transakcja / atomowość przy race:**

1. Aplikacja: `garden.placePlant` (in-memory, fail-fast).
2. DB: `INSERT` — przy równoległych requestach UNIQUE łapie drugi insert.
3. Mapowanie Postgres `23505` → `CellOccupiedError` → HTTP 409.

Migracja (backstop, nie jedyny strażnik):

```sql
-- po cleanup kolizji istniejących (jeśli są)
CREATE UNIQUE INDEX plants_unique_cell_per_user
  ON public.plants (user_id, grid_x, grid_y);
```

Opcjonalnie przed UNIQUE: skrypt diagnostyczny `SELECT user_id, grid_x, grid_y, count(*) … HAVING count(*) > 1` + ręczny/semiauto cleanup (przesunięcie duplikatów lub soft-fail migracji).

W stacku Supabase JS pełne multi-statement transactions są ograniczone — **UNIQUE index jest wymaganym mechanizmem atomowości** między requestami; in-memory check w agregacie chroni happy-path i UX.

### Cienkie API (route po refaktorze)

```ts
// POST /api/plants — pseudokod
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return jsonError(UNAUTHORIZED, 401);

  const parsed = plantBodySchema.safeParse(/* json | formData */);
  if (!parsed.success) return jsonError(VALIDATION_ERROR, 400);

  const repo = new SupabaseGardenRepository(supabase);
  const garden = await repo.loadByOwnerId(context.locals.user.id);
  if (!garden) return jsonError(PROFILE_NOT_FOUND, 400);

  try {
    const plant = garden.placePlant({
      name: parsed.data.name,
      position: { gridX: parsed.data.grid_x, gridY: parsed.data.grid_y },
      iconName: parsed.data.icon_name,
    });
    await repo.insertPlant(garden, plant);
    // optional photo upload — jak dziś, po udanym place
    return Response.json({ success: true, plant: { …, display_name } }, { status: 201 });
  } catch (e) {
    if (e instanceof CellOccupiedError) {
      return jsonError({ code: ERROR_CODES.CELL_OCCUPIED, message: e.message, details: { … } }, 409);
    }
    if (e instanceof OutOfGardenBoundsError) {
      return jsonError({ code: ERROR_CODES.INVALID_GRID_POSITION, message: e.message }, 400);
    }
    throw e;
  }
};
```

**Egzekucja przenosi się z klienta na serwer:** UI może (i powinno) blokować zajęte komórki dla UX, ale **nie jest strażnikiem** — obejście POST-em bez UI musi dostać 409.

### UI po stronie klienta (cienki, nie strażnik)

| Komponent | Zmiana |
| --- | --- |
| `GardenGridPicker` | Snap / drag odmawia zajętej komórki; komunikat „Cell A3 is taken”; nie wywołuje fan offset dla *nowej* rośliny na zajętej |
| `garden-markers` | Usunąć / zdeprecjonować `CELL_FAN_*`, `countPlantsAtCell` dla happy-path; markery 1:1 z komórką |
| `AddPlantForm` | Mapować `CELL_OCCUPIED` z API na błąd formularza |
| `GardenMapView` / `GardenPlantMarkers` | Założyć ≤1 plant/cell; uprościć layout |

---

## KROK 5 — Before/after, plan faz, testy

### Before → After (miejsca reguły)

| Miejsce | BEFORE | AFTER |
| --- | --- | --- |
| PRD FR-014 | Deklaracja bez egzekucji | Bez zmiany — staje się egzekwowana |
| `core_data_schema` / nowa migracja | Brak UNIQUE | `UNIQUE (user_id, grid_x, grid_y)` |
| `POST /api/plants` | Bounds only → insert | `Garden.placePlant` → insert; 409 on conflict |
| `ERROR_CODES` | Brak `CELL_OCCUPIED` | Dodany kod + mapowanie |
| `garden-markers.ts` | Fan multi-occupancy | Layout 1 plant/cell (fan usunięty lub dead-code po migracji) |
| `GardenGridPicker.tsx` | Offset na zajętej komórce | Blokada zajętej + komunikat UX |
| `AddPlantForm` | Zakłada zawsze sukces pozycji | Obsługa 409 |
| Archive plan S-05 „allow overlaps” | Sprzeczny z PRD | Udokumentowany supersede w change notes / lessons |
| Roadmap S-06 collision unknown | Otwarte | Zamknięte: unique occupancy (ten plan); multi-cell S-06 musi respektować I1 na zbiorze komórek |

### Plan faz refaktoru

| Faza | Opis | Test-first? | Kryterium wyjścia |
| --- | --- | --- | --- |
| **0. Lock** | Potwierdzenie: egzekwujemy FR-014 (ten dokument). Cleanup query na prod/local: czy istnieją kolizje. | — | Decyzja + wynik diagnostyki |
| **1. Domain core** | Wydzielić `Garden` + błędy domenowe (pure TS, bez Supabase). | **TAK** — unit Vitest | Testy unit green; zero zależności HTTP |
| **2. Persistence backstop** | Migracja UNIQUE (+ cleanup jeśli Phase 0 znalazła duplikaty). Regeneracja `database.types.ts` + `lint:fix`. | Integracja: insert duplikatu → błąd DB | Migracja aplikowalna; race chroniony |
| **3. Repository + thin API** | `GardenRepository.load` / `insertPlant`; przerobić `POST /api/plants`. | **TAK** — rozszerzyć `plants/index.test.ts` | Legal create 201; duplicate 409; bounds 400 |
| **4. UI enforcement** | Picker blokuje zajęte; form mapuje 409; uproszczenie markerów. | Manual / e2e opcjonalnie | Nie da się wybrać zajętej komórki w UI; API nadal strażnikiem |
| **5. Cleanup długu** | Usunąć fan helpers; zaktualizować roadmap S-06 unknown; wpis w `lessons.md`. | — | Brak dead multi-occupancy paths |
| **(później) I9 / I10** | Osobne plany — nie blokują I1 | wg test-plan risk #5 / #2 | — |

Fazy 1 i 3 są **test-first** zgodnie z dyscypliną projektu (`test-plan.md`: Vitest integration; domain pure → unit).

### Przypadki testowe niezmiennika I1

#### Unit — `Garden.placePlant` / `movePlant`

| Case | Wejście | Oczekiwanie |
| --- | --- | --- |
| L1 | Pusty ogród 5×5, place `(0,0)` | OK — 1 plant |
| L2 | Place `(0,0)` potem `(0,1)` | OK — 2 plants, różne komórki |
| I1a | Place `(0,0)` dwa razy | `CellOccupiedError`; stan bez drugiej rośliny |
| I1b | Place poza bounds `(99,0)` | `OutOfGardenBoundsError`; stan niezmieniony |
| L3 | `movePlant` A z `(0,0)` → `(1,1)` wolne | OK |
| I1c | `movePlant` A → komórka zajęta przez B | `CellOccupiedError`; pozycje bez zmian |
| L4 | `movePlant` A → ta sama komórka A | OK (no-op / allow self) |

#### Integration — `POST /api/plants`

| Case | Scenariusz | Oczekiwanie |
| --- | --- | --- |
| L5 | Pierwszy plant na `(1,1)` | 201 |
| I1d | Drugi plant tego samego usera na `(1,1)` | **409** `CELL_OCCUPIED`; w DB nadal 1 wiersz na komórkę |
| L6 | Drugi plant na `(1,2)` | 201 |
| I2a | `(99,0)` out of bounds | 400 `INVALID_GRID_POSITION` (regresja) |
| I1e | Race: dwa równoległe POST na wolną komórkę | dokładnie jeden 201, drugi 409 (UNIQUE) |
| Own | User B na komórce zajętej przez A — niezależne ogrody | 201 (unikalność per `user_id`) |

#### UI (manual / późniejsze e2e)

| Case | Oczekiwanie |
| --- | --- |
| U1 | Drag nowej rośliny na zajętą komórkę — snap odrzucony lub komunikat |
| U2 | Mapa z danymi po cleanup — brak fan offsetów |

### Load-bearing names (rejestr kontraktów)

Projekt nie ma osobnego pliku „contract registry”; kontrakty żyją w planach change + `ERROR_CODES` + testach. Zarejestrować przy implementacji:

| Nazwa | Rodzaj | Kontrakt |
| --- | --- | --- |
| `Garden` | Aggregate root | Jedyny mutator pozycji roślin w ogrodzie użytkownika |
| `PlantPlacement` | Entity (wewnątrz Garden) | Identity + `(gridX, gridY)` |
| `placePlant` / `movePlant` | Domain methods | Preconditions → throw named error; zero silent update |
| `CellOccupiedError` | Domain error | code `CELL_OCCUPIED` |
| `ERROR_CODES.CELL_OCCUPIED` | API contract | HTTP 409 (+ details: grid, occupying id opcjonalnie) |
| `plants_unique_cell_per_user` | DB constraint | `UNIQUE (user_id, grid_x, grid_y)` |
| `GardenRepository` | Port | `loadByOwnerId` + `insertPlant`; map 23505 → domain error |
| `occupiedCells()` | Read model helper | Zbiór zajętych komórek dla pickera |

Dopisać do `context/foundation/lessons.md` po implementacji:

> **Rule:** Spatial uniqueness of plant cells is a Garden aggregate invariant (FR-014). Never reintroduce multi-plant-per-cell fan layout without an explicit PRD change.

---

## Powiązanie z `01-domain-distillation.md`

Ten plan realizuje rekomendację #1 z distillacji (unique cell occupancy) przez konkretny agregat **Garden** i fazy test-first. Kandydaci #2 (last-action) i #3 (weather policy) pozostają w backlogu domenowym — nie wchodzą w zakres tego refaktoru.

---

## Definition of Done (dla przyszłej implementacji)

- [ ] `Garden.placePlant` odrzuca kolizję zanim nastąpi insert
- [ ] UNIQUE index na `(user_id, grid_x, grid_y)`
- [ ] `POST /api/plants` zwraca 409 `CELL_OCCUPIED` (integration test)
- [ ] UI nie pozwala wybrać zajętej komórki; API pozostaje strażnikiem
- [ ] Usunięty happy-path multi-occupancy (fan) z `garden-markers`
- [ ] Brak cichego sukcesu przy kolizji (fail-fast)
- [ ] `npm run lint` + `npm run check` + `npm run test:integration` green
