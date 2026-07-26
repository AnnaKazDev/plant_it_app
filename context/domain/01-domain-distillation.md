---
title: "Plant It — Domain Distillation"
created: 2026-07-26
type: domain-distillation
sources:
  - context/foundation/prd.md
  - context/foundation/shape-notes.md
  - context/foundation/idea-notes.md
  - context/foundation/roadmap.md
  - context/foundation/tech-stack.md
  - README.md
  - src/** (verified citations)
---

# Domain Distillation: Plant It

Mapa domeny odkryta z dokumentów źródłowych i kodu. Nie zakładano z góry nazw agregatów — pojęcia i granice wynikają z cytowanych źródeł.

---

## KROK 0 — Kontekst projektu

### Źródła wymagań (odkryte)

| Dokument | Rola |
| --- | --- |
| `context/foundation/prd.md` | Główne źródło wizji, success criteria, FR/NFR, non-goals, business logic |
| `context/foundation/shape-notes.md` | Narracja shapingowa (zgodna z PRD; drobne różnice w NFR pogody) |
| `context/foundation/idea-notes.md` | Wczesna idea (PL); mapa była *poza* MVP — później odwrócone w PRD |
| `context/foundation/roadmap.md` | Slice’y wdrożone vs proposed; routing; north star produktu |
| `context/foundation/tech-stack.md` | Stack: Astro + React + TS + Supabase + Cloudflare |
| `README.md` | Operacyjne: storage, weather, deploy (częściowo nadal templateowy) |

**Ograniczenie:** dokumenty są kompletne dla MVP; `idea-notes.md` jest historycznie sprzeczny z PRD w sprawie mapy ogrodu (mapa out → must-have). Przy rozjazdach **PRD wygrywa** jako kanon wymagań.

### Stack i struktura warstw (odkryte w repo)

| Warstwa | Gdzie żyje | Uwagi DDD |
| --- | --- | --- |
| UI (wyspy React / strony Astro) | `src/pages/`, `src/components/` | Renderowanie teasera, mapy, formularzy |
| API (HTTP) | `src/pages/api/{plants,actions,photos,auth,profile,action-types}/` | Walidacja zod + orkiestracja |
| „Serwis” / helpers | `src/lib/` (`plant-page`, `weather`, `grid`, `storage`, `plants`, `profile`, …) | Brak wydzielonej warstwy domenowej — reguły rozproszone |
| Persystencja | `supabase/migrations/`, typy w `src/database.types.ts` / `src/types.ts` | PostgreSQL + RLS; Storage `plant-photos` |
| Auth / dostęp | `src/middleware.ts`, Supabase Auth | Flat user model |

**Wniosek architektoniczny:** logika biznesowa jest **anemiczna** — reguły siedzą w CHECK SQL, zod w API i helperach UI, nie w jawnych agregatach domenowych.

### Wizja (kanon)

> „…a gardener wants to _see_ the plant's journey — photo history showing how it changed over time — tied to the actions that shaped that growth… The story is the product, not just the schedule.”
> — `context/foundation/prd.md:24`

North star roadmapy: wizualna historia = **photo + action + date + weather** (`context/foundation/roadmap.md:24`).

---

## KROK 1 — Ubiquitous Language

Dla każdego pojęcia: definicja z dokumentów, cytat, lokalizacja w kodzie (lub `BRAK w kodzie`).

### 1. Growth story / visual timeline

| | |
| --- | --- |
| **Definicja** | Historia wzrostu rośliny jako sekwencja zdjęć i opieki w czasie — sens produktu. |
| **Źródło** | `context/foundation/prd.md:24` — „photo history… tied to the actions… The story is the product” |
| **Kod** | Render: `src/components/plants/GrowthTimeline.tsx` (komponent); składanie historii: `src/lib/plant-page.ts:35-45` (`PlantCardPlant.actions`). Brak typu/agregatu o nazwie „GrowthStory”. |

### 2. Hobby gardener (persona Anna) / User

| | |
| --- | --- |
| **Definicja** | Zalogowany właściciel ogrodu; flat model — pełny dostęp tylko do własnych danych; bez ról/udostępniania. |
| **Źródło** | `context/foundation/prd.md:28-30`, `prd.md:174` — „Flat user model… No roles, no sharing” |
| **Kod** | `src/middleware.ts:6-57` (`PROTECTED_ROUTES`, `context.locals.user`); RLS `supabase/migrations/20260604120000_core_data_schema.sql:82-85` |

### 3. Garden (dimensions + location)

| | |
| --- | --- |
| **Definicja** | Ogród użytkownika: lokalizacja (miasto/współrzędne) + wymiary szer. × wys. w metrach; baza do siatki i pogody. |
| **Źródło** | `context/foundation/prd.md:38`, `prd.md:134` (FR-012), `prd.md:174` |
| **Kod** | Profil: `src/lib/profile-schema.ts:3-8` (`city`, `garden_width`, `garden_height`, `garden_name`); upsert `src/lib/profile.ts:12-27`; tabela `profiles` `…/20260604120000_core_data_schema.sql:5-13` (+ migracje city/name). Współrzędne lat/lng w schemacie istnieją, ale setup zbiera **miasto**, nie lat/lng. |

### 4. Garden map / map grid

| | |
| --- | --- |
| **Definicja** | Prostokątna siatka (metry → komórki), na której rozmieszczane są rośliny; widok mapy pokazuje pozycje. |
| **Źródło** | `context/foundation/prd.md:142-144` (FR-014); non-goal advanced map `prd.md:182` |
| **Kod** | Wymiary siatki: `src/lib/grid.ts:50-59`; widok: `src/pages/garden-map.astro`, `src/components/plants/GardenMapView.tsx`; markery: `src/lib/garden-markers.ts:48-78` |

### 5. Grid coordinates / grid label (np. „A3”)

| | |
| --- | --- |
| **Definicja** | Pozycja rośliny na siatce; etykieta litera+numer używana w display name. |
| **Źródło** | `context/foundation/prd.md:100` — „Sunflower (A3)” |
| **Kod** | Persystencja `grid_x`/`grid_y`: `…/core_data_schema.sql:21-22`; formatowanie: `src/lib/grid.ts:27-28`; display name: `src/lib/plants.ts:5-7` |

### 6. Plant

| | |
| --- | --- |
| **Definicja** | Roślina użytkownika: nazwa, opcjonalne zdjęcie, pozycja na siatce; wyróżnialna po nazwie + koordynatach. |
| **Źródło** | `context/foundation/prd.md:100` (FR-004), `prd.md:104` (FR-005) |
| **Kod** | Encja: `src/types.ts:7` (`Plant`); create API: `src/pages/api/plants/index.ts:15-20`, `150-160`; lista: `src/lib/plant-page.ts:52-58` |

### 7. Display name

| | |
| --- | --- |
| **Definicja** | Automatyczna nazwa prezentacyjna: `{name} ({gridLabel})`, np. „Sunflower (B7)”. |
| **Źródło** | `context/foundation/prd.md:100`, `prd.md:104` |
| **Kod** | `src/lib/plants.ts:5-7`; użycie listy: `src/lib/plant-page.ts:189` |

### 8. Plant card

| | |
| --- | --- |
| **Definicja** | Widok pełnej historii jednej rośliny (wszystkie akcje i zdjęcia). |
| **Źródło** | `context/foundation/prd.md:108` (FR-006) |
| **Kod** | Strona `src/pages/plants/[id].astro`; UI `src/components/plants/PlantCardContent.tsx`; payload `src/lib/plant-page.ts:35-50` |

### 9. Plant list / last-action teaser

| | |
| --- | --- |
| **Definicja** | Lista roślin z teaserem ostatniej akcji (zdjęcie, nazwa akcji, data, pogoda); bez akcji — photo + display name. |
| **Źródło** | `context/foundation/prd.md:104` (FR-005), success criteria `prd.md:48` |
| **Kod** | `src/lib/plant-page.ts:133-200` (`fetchPlantListForUser`); UI `src/components/plants/PlantListItem.tsx:23-47` |

### 10. Action (care / growth stage event)

| | |
| --- | --- |
| **Definicja** | Zdarzenie opieki lub etapu wzrostu przy roślinie: nazwa (predefiniowana lub własna ≤300 znaków), data (past/today/future), opcjonalne zdjęcia (max 5), opcjonalny tekst dodatkowy. |
| **Źródło** | `context/foundation/prd.md:40-41`, `prd.md:113` (FR-007), `prd.md:117` (FR-008) |
| **Kod** | Schema: `…/core_data_schema.sql:36-49`; create: `src/pages/api/actions/index.ts:12-39`, `99-110`; typ `src/types.ts:9` |

### 11. Action type (predefined)

| | |
| --- | --- |
| **Definicja** | Katalog predefiniowanych nazw akcji (np. watering, planted from seed) z ikoną. |
| **Źródło** | `context/foundation/prd.md:40` — „from seedling”, „seeds”, „watering”; seed w roadmapie |
| **Kod** | Seed: `…/core_data_schema.sql:135-166`; API `src/pages/api/action-types/index.ts`; XOR z custom: CHECK `…/core_data_schema.sql:46-49` |

### 12. Custom action name

| | |
| --- | --- |
| **Definicja** | Ręcznie wpisana nazwa akcji, max 300 znaków; wzajemnie wykluczająca się z typem predefiniowanym. |
| **Źródło** | `context/foundation/prd.md:113` |
| **Kod** | Zod: `src/pages/api/actions/index.ts:16-24`, `.refine` `36-38`; DB CHECK `…/core_data_schema.sql:40`, `46-49` |

### 13. Planned action

| | |
| --- | --- |
| **Definicja** | Akcja z datą w przyszłości; widoczna jako badge/count; bez push notifications (non-goal). |
| **Źródło** | `context/foundation/prd.md:117` (FR-008), `prd.md:125` (FR-010), `prd.md:178` |
| **Kod** | Predykat: `src/lib/action-dates.ts:11-16`; badge UI: `src/components/plants/ActionTeaser.tsx:21-22`, `74`; count: `src/lib/plant-page.ts:182` |

### 14. Action teaser

| | |
| --- | --- |
| **Definicja** | Kompaktowy podgląd akcji: pierwsze zdjęcie (lub placeholder), nazwa/tag, data, pogoda (temp, rain/sun). |
| **Źródło** | `context/foundation/prd.md:121` (FR-009), `prd.md:78-80` |
| **Kod** | `src/components/plants/ActionTeaser.tsx:56-79`; pogoda w footerze dla nie-planned |

### 15. Photo (action photo / plant photo)

| | |
| --- | --- |
| **Definicja** | Prywatne zdjęcie właściciela; do akcji max 5; typ JPEG/PNG/WebP; ≤10MB; brak udostępniania. |
| **Źródło** | Guardrails `prd.md:62-64`; NFR `prd.md:160`; FR-007 |
| **Kod** | Upload limit: `src/pages/api/photos/upload.ts:11`, `131-141`; walidacja pliku: `src/lib/photo-validation.ts:1-21`; bucket RLS: `…/20260604180000_photo_storage_setup.sql:4-26` |

### 16. Placeholder icon (brak zdjęcia akcji)

| | |
| --- | --- |
| **Definicja** | Ikona zastępcza, gdy akcja nie ma zdjęć użytkownika. |
| **Źródło** | `context/foundation/prd.md:129` (FR-011) |
| **Kod** | `src/components/plants/ActionTeaser.tsx:12-16`, `67-68` (`PlantPlaceholderImage`) |

### 17. Weather data (snapshot at action)

| | |
| --- | --- |
| **Definicja** | Warunki z dnia akcji (temp, rain/sun, …) pobrane wg lokalizacji użytkownika i daty; przechowywane przy akcji; przy awarii API — komunikat + możliwość zapisu bez pogody. |
| **Źródło** | Business logic `prd.md:166-168`; NFR `prd.md:159`; shape-notes `shape-notes.md:185` (jasniej: store at creation) |
| **Kod** | Typ: `src/types.ts:25-40`; fetch+store przy create: `src/pages/api/actions/index.ts:92-107`; serwis: `src/lib/weather.ts:91-130`, `194-203`; display: `src/lib/weather-display.ts:3-13` |

### 18. Moon phase

| | |
| --- | --- |
| **Definicja** | Faza księżyca; secondary success; w MVP teasery **bez** moon phase (kalendarz only — wg resolution FR-009). |
| **Źródło** | Secondary `prd.md:58`; resolution `prd.md:123` |
| **Kod** | Pole w snapshot: `src/types.ts:35`; **wyświetlane w teaserach**: `src/lib/weather-display.ts:41-42` + `ActionWeatherInfo`. Widok **kalendarza**: `BRAK w kodzie` (brak trasy/strony calendar w `src/lib/navigation.ts:12-18`). |

### 19. Calendar (widok / picker daty)

| | |
| --- | --- |
| **Definicja** | (a) wybór daty akcji; (b) w early idea — osobny widok kalendarza wszystkich akcji z pogodą/fazą księżyca. |
| **Źródło** | Idea: `idea-notes.md:42-46`; PRD FR-007 „selected from calendar” `prd.md:113`; secondary moon „in calendar” `prd.md:58` |
| **Kod** | Picker: native `<input type="date">` w `AddActionForm` (patrz plan review). Osobny **widok kalendarza**: `BRAK w kodzie`. |

### 20. Ownership / private photos

| | |
| --- | --- |
| **Definicja** | Użytkownik widzi tylko własne rośliny i zdjęcia; brak galerii publicznych. |
| **Źródło** | FR-003 `prd.md:95`; NFR `prd.md:160` |
| **Kod** | RLS plants/actions/photos: `…/core_data_schema.sql:82-131`; storage path `{user_id}/…`: `…/photo_storage_setup.sql:19-26`; testy `src/pages/api/ownership.test.ts` |

### 21. Search & filter

| | |
| --- | --- |
| **Definicja** | Szukanie po nazwie rośliny, typie akcji itd. |
| **Źródło** | FR-016 nice-to-have `prd.md:151` |
| **Kod** | `BRAK w kodzie` (potwierdzone roadmap: search poza S-04) |

### 22. Additional text / notes on action

| | |
| --- | --- |
| **Definicja** | Dodatkowy tekst przy akcji (success criteria: „Additional text can be also added”). |
| **Źródło** | `prd.md:41`; change `context/changes/action-notes/change.md:12` |
| **Kod** | Kolumna `additional_data`: `…/core_data_schema.sql:43`; API max 1000: `src/pages/api/actions/index.ts:26-34`; UI notes: `AddActionForm.tsx:22`, `97-98`; teaser: `ActionTeaser.tsx:77` |

---

## KROK 2 — Klasyfikacja subdomen

Uzasadnienie względem Vision (`prd.md:20-24`), Primary Success Criteria (`prd.md:34-54`), Guardrails (`prd.md:60-65`) i Non-Goals (`prd.md:176-184`).

| Obszar / pojęcia | Kategoria | Uzasadnienie |
| --- | --- | --- |
| Growth story = Plant + Actions + Photos + daty na timeline | **Core** | „The story is the product” (`prd.md:24`); north star S-02 (`roadmap.md:24`) |
| Action teaser + last-action na liście | **Core** | Kryteria sukcesu 5, 7, 11 (`prd.md:42-48`); FR-005/009 |
| Planned action (przyszła data + badge) | **Core** | Część success flow (krok 6, 11); FR-008/010; non-goal tylko *powiadomień*, nie samego planowania |
| Garden map + unikalna lokalizacja przestrzenna | **Core** | Kryteria 12–15; FR-013–015; insight „locations… track which location produces better growth” (`prd.md:52`) |
| Weather snapshot przy akcji | **Supporting** | Wzbogaca story (FR-009), ale nie jest przewagą samą w sobie — zależy od zewnętrznego API; NFR dopuszcza zapis bez pogody |
| Moon phase / Calendar view | **Supporting** (dziś częściowo niezrealizowane) | Secondary success (`prd.md:58`); moon wyrzucony z teaserów w resolution FR-009 |
| Garden profile (miasto, wymiary) | **Supporting** | Wymagane wejście do Core (siatka + pogoda), ale nie wyróżnik produktu |
| Auth (email/password) + Ownership/RLS | **Generic** | Standardowy dostęp; flat model; non-goal sharing (`prd.md:180`) |
| Photo storage (bucket, MIME, size) | **Generic** | Infrastruktura plików; limit 5 to reguła Core egzekwowana na generic storage |
| Search/filter | **Supporting** (nice-to-have) | FR-016; poza critical path sukcesu |
| Push notifications | **Out of domain (non-goal)** | `prd.md:178` |
| Multi-user sharing / advanced map shapes | **Out of domain (non-goal)** | `prd.md:180-182` |

---

## KROK 3 — Kandydaci na agregaty i niezmienniki

### A. Plant (w granicach Garden użytkownika)

| Niezmiennik | Źródło | Status w kodzie |
| --- | --- | --- |
| Plant należy do jednego użytkownika; inni nie widzą | FR-003 `prd.md:95` | **Egzekwowany** — RLS `core_data_schema.sql:82-85`; API filtruje przez klienta z sesją |
| Pozycja `(grid_x, grid_y)` mieści się w wymiarach ogrodu | FR-013 + wymiary FR-012 | **Egzekwowany** w API — `plants/index.ts:125-134` + `grid.ts:57-59`; DB tylko `>= 0`, bez górnego bound względem garden |
| Display name = name + koordynaty | FR-004 `prd.md:100` | **Deklarowany w read-model** — `plants.ts:5-7` (nie przechowywany; wyliczany) |
| Każda roślina ma **inną** lokalizację na mapie | FR-014 `prd.md:142`; success `prd.md:46,50` | **Ignorowany / odwrotnie** — brak UNIQUE; UI świadomie obsługuje wiele roślin w komórce (`garden-markers.ts:48-78`, `96-98`) |
| Opcjonalne zdjęcie rośliny → default icon | FR-004 | **Częściowo egzekwowany** — `icon_name` + placeholder UI; brak twardej reguły domenowej |

### B. Action (w granicach Plant)

| Niezmiennik | Źródło | Status w kodzie |
| --- | --- | --- |
| XOR: predefiniowany typ **albo** custom name (nie oba, nie żaden) | FR-007 + schema | **Egzekwowany** — DB CHECK `core_data_schema.sql:46-49` + zod refine `actions/index.ts:36-38` |
| Custom name ≤ 300 znaków | FR-007 `prd.md:113` | **Egzekwowany** — DB + zod |
| Data może być past / today / future | FR-008 `prd.md:117` | **Dopuszczony** — brak ograniczenia daty; planned = future via `action-dates.ts:11-16` |
| Max 5 photos per action | Guardrail `prd.md:64`; FR-007 | **Egzekwowany w API** — `photos/upload.ts:11`, `131-141`; **BRAK** constraintu w DB |
| Weather zapisany przy tworzeniu (historyczny snapshot); awaria → retry lub save without | NFR `prd.md:159`; `shape-notes.md:185` | **Częściowo** — zapis z `weather_data` nullable `actions/index.ts:92-107`; przy fail API cicho `null` (weather service returns null). **Brak** UX „retry / save without weather” — formularz nie oferuje wyboru (`AddActionForm.tsx:110-124` zawsze tworzy akcję) |
| Planned action ≠ pokazywanie pogody w teaserze (impl. decyzja) | UI | **Egzekwowany w UI** — `ActionTeaser.tsx:63` ukrywa weather dla planned |

### C. Garden / Profile

| Niezmiennik | Źródło | Status w kodzie |
| --- | --- | --- |
| Rejestracja wymaga lokalizacji + wymiarów ogrodu | FR-001, FR-012 | **Egzekwowany** — `signup.ts:12-17`, `profile-schema.ts:3-8`; city walidowane WeatherAPI |
| Wymiary > 0 | FR-012 | **Egzekwowany** — DB CHECK `garden_width > 0` `core_data_schema.sql:9-10`; zod min 0.1m |

### D. Photo privacy

| Niezmiennik | Źródło | Status w kodzie |
| --- | --- | --- |
| Tylko właściciel widzi zdjęcia | Guardrail `prd.md:62`; NFR `prd.md:160` | **Egzekwowany** — private bucket + path RLS `photo_storage_setup.sql:19-26`; signed URLs w `plant-page.ts:97-105` |

### E. (Odrzucony jako agregat MVP) Calendar

Brak bytu w kodzie; w PRD secondary/calendar-only moon. Nie tworzyć agregatu do czasu jawnego slice’u.

---

## KROK 4 — Rozjazdy MODEL vs KOD

| # | Dokument mówi (X) | Kod robi (Y) | Dowód |
| --- | --- | --- | --- |
| 1 | Każda roślina ma **różną** lokalizację na mapie (FR-014; success 9/13) | Wiele roślin może zajmować tę samą komórkę; layout „fan” | `prd.md:142` vs `garden-markers.ts:48-78`, `96-98`; brak UNIQUE w `core_data_schema.sql:16-25` |
| 2 | Lista: teaser **ostatniej** akcji z pogodą dnia akcji (FR-005 / success 11) | „Last” = pierwsza po sortowaniu daty **malejąco** → przyszła planned może wypchnąć ostatnią wykonaną | `prd.md:104,48` vs `plant-page.ts:181-185` + `action-dates.ts:18-19` |
| 3 | Moon phase **usunięty** z action teasers; tylko kalendarz (resolution FR-009) | Moon phase renderowany w detail lines teasera; kalendarza brak | `prd.md:123` vs `weather-display.ts:41-42`; nav bez calendar `navigation.ts:12-18` |
| 4 | Secondary: moon + weather w **calendar** | Brak widoku kalendarza | `prd.md:58`; `idea-notes.md:42-46` vs `BRAK` strony calendar |
| 5 | Przy niedostępności Weather API: jasny błąd + retry **lub** save without weather | Create action: fail → `weather_data: null`, HTTP 201; UI nie pokazuje retry/choice | `prd.md:159` vs `weather.ts:106-109` (return null) + `actions/index.ts:92-107` + `AddActionForm.tsx:110-124` |
| 6 | Weather dla historycznych akcji = warunki z czasu akcji; API przy create | Planned (future) woła `history.json` (typowo past-only) → null; UI i tak ukrywa weather dla planned | `prd.md:159` vs `weather.ts:98` (`history.json`); `ActionTeaser.tsx:63` |
| 7 | Lokalizacja: city **lub coordinates** | Setup zbiera city; lat/lng w tabeli nie ustawiane przy signup | `prd.md:38,174` vs `profile.ts:12-18`; kolumny lat/lng `core_data_schema.sql:7-8` |
| 8 | FR-016 search (nice-to-have) | Brak wyszukiwania | `prd.md:151` vs brak w `PlantListContent` / API list |
| 9 | Usuwanie pojedynczych plants **lub actions** wspierane | DELETE plant w UI+API; DELETE action tylko API, **bez UI** (roadmap przyznaje) | `prd.md:158` vs `plants/[id].ts:124-158`, `actions/[id].ts:142-175`; `roadmap.md:55` |
| 10 | Cache/reuse pogody po dacie (impl.) może mieszać lokalizacje | `getCachedWeather` szuka dowolnej akcji z `weather_data` po `date` bez city/user | `weather.ts:132-147` vs NFR „conditions at the time… for that date and location” `prd.md:159,168` |
| 11 | Max 5 photos — reguła biznesowa | Tylko warstwa API; race dwóch uploadów może przekroczyć 5 | `photos/upload.ts:131-141`; brak CHECK/trigger w migracjach photos |
| 12 | Early idea: mapa **poza** MVP | PRD + kod: mapa must-have / zaimplementowana | `idea-notes.md:52` vs `prd.md:142` + `garden-map` routes |

---

## KROK 5 — Ranking refaktoru (agregaty / niezmienniki)

Skala: **wartość** = jak blisko Core / success criteria; **ryzyko** = jak słabo dziś egzekwowane (1=silne, 5=ignorowane).

| Rank | Kandydat / niezmiennik | Wartość (Core?) | Ryzyko egzekucji | Komentarz |
| --- | --- | --- | --- | --- |
| **#1** | **Plant.unique cell occupancy** (FR-014 / success spatial story) | Bardzo wysoka — „which location produces better growth” | 5 — kod *umożliwia* kolizje | Albo przyjąć multi-plant-per-cell jako nową regułę domenową i poprawić PRD, albo egzekwować UNIQUE(user_id, grid_x, grid_y) + walidację w create — dziś model i kod mówią coś innego |
| **#2** | **PlantList.lastAction semantics** (ostatnia *wykonana* vs max(date)) | Wysoka — codzienny ekran po loginie | 4 — mylący teaser/pogoda | Filtr: last non-planned (lub last date ≤ today) przed teaserem |
| **#3** | **Action.weather capture policy** (fail visibility + save-without) | Wysoka (Supporting essential do story) | 4 — ciche null | Jawna polityka domenowa + API/UI; rozdzielić past history vs future forecast |
| **#4** | **Action.photoQuota** (max 5) trwałość | Średnia-wysoka (guardrail) | 3 — tylko API | Przenieść do DB constraint/trigger lub transakcji |
| **#5** | **Moon/calendar language cleanup** | Niska (secondary) | 2 — niespójność docs/UI | Albo usunąć moon z `weather-display` teasera, albo zaktualizować PRD; calendar = osobny slice |
| **#6** | **Action aggregate boundary** (Plant owns Actions+Photos) | Strukturalna | 2 — reguły rozproszone | Wydzielić serwis/agregat dopiero po ustaleniu #1–#3 |

### Rekomendacja #1

**Najpierw rozstrzygnąć niezmiennik lokalizacji rośliny na siatce.**

To jedyny punkt, w którym dokument Core (porównanie lokalizacji wzrostu — success krok 15, FR-014) jest **aktywnie zaprzeczony** przez kod (`garden-markers` multi-occupancy). Refaktor bez decyzji produktowej pogłębi dług: albo egzekwować unikalność komórki jako twardy niezmiennik agregatu Plant-w-Garden, albo oficjalnie zmienić ubiquitous language na „wiele roślin w komórce” i dostosować success criteria. Dopiero potem warto porządkować semantykę „last action” i politykę pogody — one psują odczyt story, ale nie negują wprost wymogu FR.
