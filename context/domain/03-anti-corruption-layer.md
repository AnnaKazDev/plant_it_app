---
title: "Plant It — Anti-Corruption Layer Refactor Plan"
created: 2026-07-26
type: refactor-plan
sources:
  - context/foundation/prd.md
  - context/foundation/roadmap.md
  - context/foundation/tech-stack.md
  - context/foundation/test-plan.md
  - context/domain/01-domain-distillation.md
  - context/changes/weather-api-integration/plan.md
  - README.md
  - package.json
  - https://www.weatherapi.com/docs/ (History / Forecast / Current; icon URL; error 1006)
  - src/** (verified citations)
---

# Anti-Corruption Layer: Weather Provider Boundary

Plan izolacji najgorszego przecieku zależności zewnętrznej przez granice warstw. **Nie jest implementacją** — opisuje odkrycie, klasyfikację, diagnozę i projekt ACL (value object + port + adapter).

---

## KROK 0 — Kontekst

### Źródła

| Dokument | Rola dla granic |
| --- | --- |
| `context/foundation/prd.md` | FR-009 (teaser + weather); NFR: snapshot z dnia akcji; fail → błąd + retry lub save without |
| `context/foundation/roadmap.md` | F-03: wybór providera **z jawną intencją wymienialności** |
| `context/foundation/tech-stack.md` | Astro + React + TS + Supabase + Cloudflare; weather API jako wymaganie MVP |
| `context/foundation/test-plan.md` | Risk #2: mock na krawędzi weather HTTP; nie mockować wewnętrznych helperów Supabase |
| `context/changes/weather-api-integration/plan.md` | Pierwotna integracja — `WeatherData` + `WeatherService` bez warstwy domenowej |
| `README.md` | Operacyjne: WeatherAPI.com setup |
| `package.json` | Manifest zależności npm (WeatherAPI **nie** jest pakietem — to HTTP vendor) |

### Stack i warstwy (odkryte)

| Warstwa | Lokalizacja | Zależności zewnętrzne dziś |
| --- | --- | --- |
| UI (React / Astro) | `src/components/`, `src/pages/*.astro` | lucide-react; **kształt WeatherAPI** via `WeatherData` / `TodayWeatherInfo`; typ `User` z `@supabase/supabase-js` w jednym komponencie |
| API (HTTP) | `src/pages/api/` | zod; `WeatherService`; `@/lib/supabase`; kody `WEATHER_API_*` |
| Helpers („serwis”) | `src/lib/` | `@supabase/*`, `WeatherService` + URL-e `api.weatherapi.com`, mapowanie vendor→`WeatherData` |
| Domena | **BRAK** | Brak VO / portu — kształt vendora = kontrakt aplikacji |
| Persystencja | `actions.weather_data` JSONB | Przechowuje kształt zbliżony do mapowania WeatherAPI (`temp_max`, `moon_phase`, …) |

**Deklaracja wymienialności (intencja):**

> Which weather API to use? OpenWeatherMap …, WeatherAPI.com …, or other? … (recommend WeatherAPI.com for higher free tier; **can swap later if needed**).
> — `context/foundation/roadmap.md:139`

**Wniosek KROK 0:** dokumenty zakładają, że provider pogody jest **wymienialny**. Kod wiąże kształt WeatherAPI.com z typami współdzielonymi, API, UI, JSONB i helperami wyświetlania — intencja i kod są w rozjeździe.

---

## KROK 1 — Identyfikacja przeciekających zależności

Sygnały: ten sam vendor w wielu warstwach; zduplikowana rekonstrukcja typów; typy vendora w DTO/read-model/UI; SDK/HTTP po obu stronach granicy.

### Kandydat A — WeatherAPI.com (HTTP vendor, nie npm)

**Jak „znają” zależność:** URL-e hosta, typy odpowiedzi (`maxtemp_c`, `forecastday`, `moon_phase`), typ aplikacji `WeatherData` z komentarzem do docs vendora, kody błędów `WEATHER_API_*`, ikony `cdn.weatherapi.com`.

| Plik:linia | Co przecieka |
| --- | --- |
| `src/types.ts:23-40` | `WeatherData` — współdzielony kontrakt z referencją do WeatherAPI.com; pola vendorowe (`temp_max`, `moon_phase`, index signature) |
| `src/types.ts:77-79` | `ERROR_CODES.WEATHER_API_*` — nazwy vendora w kontrakcie API |
| `src/lib/weather.ts:3-31` | Lokalne typy `WeatherApiForecastDay` / `WeatherApiForecastResponse` (rekonstrukcja JSON vendora) |
| `src/lib/weather.ts:33-38` | `TodayWeatherInfo` eksportowany poza adapter (UI importuje) |
| `src/lib/weather.ts:40-45` | `normalizeWeatherIconUrl` — wiedza o `//cdn…` z WeatherAPI |
| `src/lib/weather.ts:47-49` | `normalizeCityNameForWeatherApi` — quirk vendora (diakrytyki) w nazwie publicznej |
| `src/lib/weather.ts:52-69` | `mapForecastDayToWeatherData` — jedyne mapowanie, ale wynik = kształt vendora w `WeatherData` |
| `src/lib/weather.ts:98`, `:160`, `:224`, `:271` | URL-e `https://api.weatherapi.com/v1/{history,forecast,current}.json` |
| `src/lib/weather.ts:112`, `:174`, `:238` | Cast JSON → `WeatherApiForecastResponse` |
| `src/lib/weather.ts:132-147` | Cache z JSONB castowany do `WeatherData` (SupabaseClient w tym samym pliku) |
| `src/lib/weather.ts:289` | Kod błędu vendora `1006` (city not found) |
| `src/lib/weather-display.ts:1-13`, `:22-54` | UI helpers na `WeatherData` (`temp_min`/`temp_max`/`precip`/`moon_phase`) |
| `src/lib/plant-page.ts:8-9`, `:31`, `:81`, `:128`, `:348-349`, `:431` | Read-model + live fetch `WeatherService` / `TodayWeatherInfo` / `WeatherData` |
| `src/lib/plant-card-client.ts:9`, `:23`, `:36` | Klient mapuje wire `weather_data: WeatherData` |
| `src/lib/city-validation.ts:1-5` | Signup/setup woła `WeatherService` bezpośrednio |
| `src/lib/config-status.ts:20-24` | Docs URL hardcode WeatherAPI.com |
| `src/lib/weather.test.ts` (m.in. `:9`, `:98`, `:228`, `:264`) | Fixture’y URL/CDN/kształtu vendora |
| `src/lib/weather-manual-test.ts:6-13`, `:28-33` | Ręczny skrypt na `WeatherService` + pola `WeatherData` |
| `src/pages/api/actions/index.ts:5`, `:8`, `:92-107` | API tworzy akcję: `WeatherService` + zapis `WeatherData` do JSONB |
| `src/pages/api/actions/[id].ts:5`, `:8`, `:104-114` | PATCH — ten sam przeciek |
| `src/pages/api/auth/signup.ts:8`, `:41-47` | `WEATHER_API_KEY` + walidacja miasta |
| `src/pages/api/profile/setup.ts:6`, `:49-53` | j.w. |
| `src/components/plants/ActionWeatherInfo.tsx:3`, `:6`, `:23-28` | UI props: `WeatherData \| null` |
| `src/components/plants/WeatherDetailList.astro:3`, `:6` | Astro props: `WeatherData` |
| `src/components/plants/GardenMapContextBar.astro:4`, `:12`, `:60-61`, `:126-127` | UI: `TodayWeatherInfo` + `condition_icon_url` |
| `src/components/plants/ActionTeaser.tsx:63` | Przekazuje `action.weather_data` do `ActionWeatherInfo` |
| `src/components/plants/ActionTeaserCard.tsx:78` | j.w. |
| `src/pages/api/plants/[id].ts:56`, `:98` | Wire response: surowy `weather_data` z DB |
| `supabase/migrations/20260604120000_core_data_schema.sql:42` | Kolumna `weather_data JSONB` (schemat neutralny; **zawartość** = kształt vendora) |
| `README.md:222-239` | Operacyjna dokumentacja WeatherAPI.com |

**Warstwy dotknięte:** types (kontrakt) + lib + API + UI + DB payload + docs + testy.

### Kandydat B — `@supabase/supabase-js` (+ `@supabase/ssr`)

| Plik:linia | Co przecieka |
| --- | --- |
| `src/lib/supabase.ts:1-2` | Fabryka klientów (właściwe miejsce infra) |
| `src/lib/profile.ts:1`, `plants.ts:1`, `storage.ts:1`, `weather.ts:1`, `test-utils.ts:5-7` | `SupabaseClient` w sygnaturach helperów |
| `src/middleware.ts:2` | Auth middleware |
| `src/env.d.ts:3` | `locals.user: User` z pakietu |
| `src/components/HomeDashboard.astro:2`, `:8` | **UI importuje** `User` z `@supabase/supabase-js` |
| Większość `src/pages/api/**` + layouty | `createClient` |

**Warstwy:** infra + API + helpers + 1× UI (typ). Brak deklaracji „możemy wymienić Supabase”.

### Kandydat C — `zod`

Importowany w warstwie API / schema (`src/pages/api/**`, `src/lib/profile-schema.ts`, `src/lib/photo-validation.ts`). To walidacja na krawędzi HTTP — **nie przeciek domeny** w sensie DDD ACL (brak typów zod w UI read-modelach jako kontrakt domenowy).

### Kandydat D — `lucide-react`

Tylko UI / `plant-icons.ts`. Brak w API/DB. Niski priorytet ACL.

---

## KROK 2 — Klasyfikacja i wybór #1

Skala osi: (a) zasięg warstw/plików, (b) koszt wymiany **dziś**, (c) deklarowana wymienialność (rozjazd intencja↔kod).

| Kandydat | (a) Zasięg | (b) Koszt wymiany dziś | (c) Intencja wymienialności | Score przecieku |
| --- | --- | --- | --- | --- |
| **A WeatherAPI.com** | **5 warstw**: types, lib, API, UI, JSONB payload + testy (~25 plików) | **Wysoki** — zmiana providera = rewrite mapowań, fixture’ów, helperów UI, migracja historycznych JSONB, rename error codes | **Tak** — `roadmap.md:139` „can swap later” | **#1** |
| B Supabase | Wiele plików, ale głównie infra/API; UI prawie nie zna SDK | Bardzo wysoki (auth+DB+storage) | **Nie** w foundation (stack locked) | #2 |
| C zod | API/schema | Niski | N/A (krawędź walidacji) | — |
| D lucide | UI | Niski | N/A | — |

### Uzasadnienie #1: WeatherAPI.com

1. **Jedyna zależność z jawną deklaracją swap** w roadmapie — i jednocześnie najbardziej rozsmarowana po UI/API/types.
2. `WeatherData` w `src/types.ts` jest **udawanym typem domenowym**, a w praktyce zrzutem pól vendora (potwierdzone mapowaniem `maxtemp_c` → `temp_max` w `weather.ts:52-69` oraz komentarzem `types.ts:23-24`).
3. UI (`ActionWeatherInfo`, `WeatherDetailList`, `GardenMapContextBar`) konsumuje ten kształt bezpośrednio — wymiana OpenWeatherMap/Open-Meteo wymagałaby dziś zmian w teaseraach, nie tylko w adapterze.
4. Test-plan już wskazuje właściwą krawędź mocka (`test-plan.md` risk #2: mock weather HTTP) — brakuje tylko twardej granicy domenowej, którą ACL domyka.

Supabase jest #2 (typ `User` w UI), ale nie ma deklaracji wymienialności i jest rdzeniem stacku — osobny plan, nie ten.

---

## KROK 3 — Diagnoza

### 3.1 Intencja vs kod

| Dokument (intencja) | Kod (stan) |
| --- | --- |
| `roadmap.md:139` — wybór API, **can swap later** | Host, typy odpowiedzi, CDN ikon, error `1006`, nazwy pól i `ERROR_CODES.WEATHER_API_*` rozsiane poza jednym adapterem |
| F-03 outcome: „service wrapper” (`roadmap.md:131`) | Wrapper istnieje (`WeatherService`), ale **eksportuje kształt vendora** do reszty aplikacji zamiast go ukrywać |
| PRD FR-009: teaser pokazuje temperature / rain / sun (`prd.md:121`) | UI czyta `temp_max`/`precip`/`moon_phase` z `WeatherData` — język bliższy JSON-owi API niż ubiquitous language PRD |
| Distillation: weather = Supporting (`01-domain-distillation.md:249`) | Supporting domain **bez** ACL → vendor wciąga Core read-model (teaser = north star) |

### 3.2 Duplikacja rekonstrukcji / castów (cytaty)

**Definicja kontraktu (współdzielona):**

```23:40:src/types.ts
// Weather data structure from WeatherAPI.com
// Reference: https://www.weatherapi.com/api-explorer.aspx
export interface WeatherData {
  temp_max: number; // Celsius
  temp_min: number;
  wind: number; // km/h or mph depending on API config
  precip: number; // mm
  humidity: number; // percentage
  sunrise: string; // time string
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  condition_text?: string;
  uv?: number;
  // Additional fields as needed; store full API response as JSONB
  [key: string]: unknown;
}
```

**Mapowanie vendora → ten sam kształt (jedyny mapper, wynik nadal vendorowy):**

```52:69:src/lib/weather.ts
function mapForecastDayToWeatherData(forecastDay: WeatherApiForecastDay): WeatherData {
  const { day, astro } = forecastDay;

  return {
    temp_max: day.maxtemp_c,
    temp_min: day.mintemp_c,
    wind: day.maxwind_kph,
    precip: day.totalprecip_mm,
    humidity: day.avghumidity,
    sunrise: astro.sunrise,
    sunset: astro.sunset,
    moonrise: astro.moonrise,
    moonset: astro.moonset,
    moon_phase: astro.moon_phase,
    ...(day.condition?.text ? { condition_text: day.condition.text } : {}),
    ...(typeof day.uv === "number" ? { uv: day.uv } : {}),
  };
}
```

**Cast JSONB → `WeatherData` (read path, bez walidacji kształtu):**

```128:128:src/lib/plant-page.ts
    weather_data: action.weather_data as WeatherData | null,
```

```147:147:src/lib/weather.ts
      return data.weather_data as WeatherData;
```

**UI na surowym kształcie:**

```3:7:src/components/plants/ActionWeatherInfo.tsx
import type { WeatherData } from "@/types";

interface ActionWeatherInfoProps {
  weather: WeatherData | null;
}
```

```3:13:src/lib/weather-display.ts
export function formatWeatherSummary(weather: WeatherData | null): string {
  if (!weather) {
    return "Weather unavailable";
  }

  const temps = `${String(weather.temp_min)}–${String(weather.temp_max)}°C, rain ${String(weather.precip)} mm`;
```

**API zapisuje wynik adaptera 1:1 do wire/DB:**

```92:107:src/pages/api/actions/index.ts
  let weatherData: WeatherData | null = null;

  if (profile?.location_city && WEATHER_API_KEY) {
    const weatherService = new WeatherService(WEATHER_API_KEY);
    weatherData = await weatherService.getWeatherForDateByCity(toWeatherDate(date), profile.location_city, supabase);
  }

  const { data: action, error: insertError } = await supabase
    .from("actions")
    .insert({
      // ...
      weather_data: weatherData as Json | null,
```

### 3.3 Przecieki przez granice (najgroźniejsze)

| Granica | Przeciek | Ryzyko |
| --- | --- | --- |
| Vendor → shared types | `WeatherData` w `src/types.ts` | Każda zmiana providera = breaking change globalnego typu |
| Vendor → UI | `ActionWeatherInfo` / `GardenMapContextBar` znają pola i `TodayWeatherInfo` | Bundle/UI sprzężone z JSON-em API (niekoniecznie npm w kliencie, ale **kontrakt** tak) |
| Vendor → JSONB | Historyczne wiersze = kształt mapowania WeatherAPI | Swap providera bez migracji read-path → silent wrong/null weather |
| Vendor quirk → domena miasta | `normalizeCityNameForWeatherApi` publiczne | Kolejny adapter dziedziczy quirk lub go gubi |
| Error codes | `WEATHER_API_*` w `ERROR_CODES` | Klienci/API docs mówią o vendorze, nie o capability |
| Cache key | `getCachedWeather` po samej `date` (`weather.ts:132-147`) | Niezgodne z NFR lokalizacji; ACL powinien zamknąć politykę cache przy porcie |

**Uwaga o bundlu klienta:** WeatherAPI nie jest pakietem npm wciąganym do islands — przeciek jest **kontraktowy** (typy + pola + CDN URL-e w HTML). To wciąż łamie ACL: UI nie powinno znać kształtu odpowiedzi History/Forecast API.

### 3.4 Otwarte pytania vendora — rozstrzygnięte z dokumentacji WeatherAPI.com

Źródło: [WeatherAPI Docs](https://www.weatherapi.com/docs/).

| Pytanie | Decyzja (kodować w ACL/adapterze, nie w API/UI) |
| --- | --- |
| History vs future dates | History API: `dt` on/after **2010-01-01**. Forecast: today…+14d. Future API: 14…300d (osobny endpoint). Adapter: past → `history.json`; today context bar → `forecast.json`; future action dates → **nie wołać history** (zwróć `null` / `Unavailable`) — zgodnie z obecnym UI ukrywającym weather dla planned |
| Ikony `//cdn.weatherapi.com/...` | Docs: `condition:icon` bywa protocol-relative. **Tylko adapter** normalizuje do `https:` (`normalizeWeatherIconUrl` dziś w `weather.ts:40-45`) |
| City not found | Error code **1006** — mapować w adapterze na domenowy `CityNotFound`; API dostaje już wynik portu |
| Jednostki | Mapować zawsze do SI domeny: °C, mm, km/h (obecne `*_c` / `*_mm` / `*_kph`) — niezależnie od domyślnych jednostek konta vendora |
| Diakrytyki w `q=` | Quirk WeatherAPI — zostaje w adapterze jako prywatna normalizacja query; **nie** w nazwie publicznej domeny |

---

## KROK 4 — Projekt ACL

### 4.1 Domain value object — jedyne miejsce wiedzy o kształcie snapshotu

Nazwa odkryta z ubiquitous language PRD/distillation: **Weather Snapshot** (supporting concept przy Action), nie „WeatherAPI response”.

```ts
// src/domain/weather/WeatherSnapshot.ts  (pure TS — zero fetch, zero Supabase)

/** Canonical garden-day weather attached to an Action (or shown as "today"). */
export type WeatherSnapshot = {
  readonly tempMaxC: number;
  readonly tempMinC: number;
  readonly precipMm: number;
  readonly windKph: number;
  readonly humidityPercent: number;
  readonly sunrise: string;   // display time as captured
  readonly sunset: string;
  readonly moonrise: string;
  readonly moonset: string;
  readonly moonPhase: string | null;  // optional; PRD secondary
  readonly conditionText: string | null;
  readonly uvIndex: number | null;
};

export type TodayWeather = {
  readonly currentTempC: number | null;
  readonly conditionText: string | null;
  /** Absolute https URL safe for <img src>, or null */
  readonly conditionIconUrl: string | null;
  readonly forecast: WeatherSnapshot | null;
};

/** JSONB persistence shape — versioned, domain-owned (NOT vendor field names). */
export type WeatherSnapshotPersistedV1 = {
  v: 1;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  windKph: number;
  humidityPercent: number;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string | null;
  conditionText: string | null;
  uvIndex: number | null;
};

// Pseudocode — jedyne mapowania persystencji:
function toPersisted(s: WeatherSnapshot): WeatherSnapshotPersistedV1 { /* ... */ }
function fromPersisted(json: unknown): WeatherSnapshot | null {
  // 1) if v===1 → map domain fields
  // 2) else legacy WeatherAPI-shaped { temp_max, ... } → migrate-on-read to WeatherSnapshot
  // 3) else null
}

function summaryLine(s: WeatherSnapshot): string { /* "Partly cloudy · 12–15°C, rain 2 mm" */ }
function detailLines(s: WeatherSnapshot): { icon: "droplets"|"wind"|"moon"|"sun"|"uv"; label: string }[] { /* ... */ }
```

**Operacje domenowe na VO (bez I/O):**

- `WeatherSnapshot.equals` / identity by value
- `isCompleteEnoughForTeaser()` — min. temp + precip (FR-009)
- `toPersisted` / `fromPersisted` — **jedyne** miejsce wiedzy o JSONB
- Presenters `summaryLine` / `detailLines` — UI dostaje gotowe stringi/linie, nie surowe pola vendora

### 4.2 Wąski port (interfejs domenowy)

```ts
// src/domain/weather/WeatherProvider.ts

export type WeatherLocation =
  | { kind: "city"; cityName: string }
  | { kind: "coordinates"; latitude: number; longitude: number };

export type CityValidation =
  | { ok: true }
  | { ok: false; reason: "not_found" | "misconfigured" | "unavailable" };

export interface WeatherProvider {
  /** Historical / day snapshot for an action date at garden location. */
  getSnapshotForDate(date: string /* YYYY-MM-DD */, location: WeatherLocation): Promise<WeatherSnapshot | null>;

  /** Live "today" strip for garden map context bar. */
  getTodayWeather(location: Extract<WeatherLocation, { kind: "city" }>): Promise<TodayWeather | null>;

  /** Signup / garden setup — does the city resolve for weather? */
  validateCity(cityName: string): Promise<CityValidation>;
}
```

**Świadomie poza portem:**

- Cache DB (`getCachedWeather`) → osobny port `WeatherSnapshotCache` lub metoda aplikacji w serwisie aplikacyjnym, nie w vendor adapterze mieszanym z Supabase (dziś `weather.ts` łączy HTTP + Supabase — rozdzielić).
- `WEATHER_API_KEY` / URL-e — tylko konstruktor adaptera.

### 4.3 Adapter (jedyny znawca WeatherAPI.com)

```ts
// src/infrastructure/weather/WeatherApiComAdapter.ts
// implements WeatherProvider

class WeatherApiComAdapter implements WeatherProvider {
  constructor(private readonly apiKey: string) {}

  async getSnapshotForDate(date, location) {
    // choose history.json vs refuse future (decision table KROK 3.4)
    // fetch https://api.weatherapi.com/v1/...
    // map maxtemp_c / maxwind_kph / moon_phase → WeatherSnapshot
    // normalize icon NEVER leaks protocol-relative URLs outside this file
  }

  async getTodayWeather(location) { /* forecast.json + current → TodayWeather */ }

  async validateCity(cityName) {
    // current.json; map HTTP 401/403 → misconfigured; body.error.code===1006 → not_found
  }
}

// private:
function normalizeQueryCity(city: string): string { /* NFD strip — WeatherAPI quirk */ }
function mapForecastDay(day: WeatherApiForecastDay): WeatherSnapshot { /* ... */ }
```

**Kompozycja w API (cienka orkiestracja):**

```ts
// pseudocode POST /api/actions
const provider: WeatherProvider = new WeatherApiComAdapter(WEATHER_API_KEY);
const snapshot = await provider.getSnapshotForDate(date, { kind: "city", cityName: profile.location_city });
await actionsRepo.insert({ ..., weather_data: snapshot ? toPersisted(snapshot) : null });
// response DTO: weather: snapshot ? { summary, details } : null  — NIE surowy WeatherData
```

### 4.4 Read-model / UI po ACL

| Dziś | Po |
| --- | --- |
| `weather_data: WeatherData` w `PlantCardAction` | `weather: { summary: string; details: WeatherDetailLine[] } \| null` **albo** `weather: WeatherSnapshot \| null` (domenowy, bez vendor names) |
| `TodayWeatherInfo` z `@/lib/weather` w Astro | `TodayWeather` z `@/domain/weather` (lub gotowy view-model z page loadera) |
| `formatWeatherSummary(weather: WeatherData)` | `summaryLine(snapshot)` w domenie / thin display adapter bez vendor fields |

---

## KROK 5 — Dowód izolacji + before/after

### 5.1 Dowód: wymiana biblioteki/providera

Zakładany swap: WeatherAPI.com → Open-Meteo (lub OpenWeatherMap).

| Warstwa | Czy wymaga zmian przy swap? | Uzasadnienie |
| --- | --- | --- |
| Adapter `WeatherApiComAdapter` | **Tak** — zastąpiony nowym plikiem | Jedyne URL-e, JSON types, quirks |
| Port `WeatherProvider` | Nie | Sygnatury domenowe |
| `WeatherSnapshot` + `toPersisted`/`fromPersisted` | Nie (chyba że nowe pola produktowe) | Kształt domenowy stabilny |
| Tabela `actions.weather_data` | Nie (kolumna JSONB zostaje) | Migracja-on-read legacy w `fromPersisted` |
| `POST/PATCH /api/actions` | Nie (poza DI: który adapter) | Woła port |
| UI teasery / garden map | Nie | Dostają summary/details lub `WeatherSnapshot` |
| Signup city validation | Nie | `validateCity` na porcie |

### 5.2 Before → After (zduplikowane / przeciekające miejsca)

| Miejsce | BEFORE | AFTER |
| --- | --- | --- |
| `src/types.ts` `WeatherData` | Globalny kontrakt = WeatherAPI shape | Usunięty lub `@deprecated` alias; kanon = `WeatherSnapshot` |
| `src/lib/weather.ts` | God-object: HTTP + map + cache Supabase + city validation | Rozcięty: adapter HTTP + opcjonalny cache app-service |
| `weather-display.ts` | Czyta `temp_max` / `moon_phase` | Czyta `WeatherSnapshot` lub przyjmuje gotowe linie z page model |
| `ActionWeatherInfo.tsx` | `weather: WeatherData \| null` | `summary` + `details` **lub** `WeatherSnapshot` |
| `GardenMapContextBar.astro` | `TodayWeatherInfo` z lib/weather | `TodayWeather` domenowy / view-model |
| `actions/index.ts` | `new WeatherService` + cast JSON | `WeatherProvider` + `toPersisted` |
| `plant-page.ts` | `as WeatherData` | `fromPersisted(json)` |
| `plant-card-client.ts` | Wire typ `WeatherData` | Wire typ domenowy / view DTO |
| `ERROR_CODES.WEATHER_API_*` | Nazwa vendora | `WEATHER_UNAVAILABLE` / `WEATHER_MISCONFIGURED` / `WEATHER_RATE_LIMIT` (mapowanie w adapterze) |
| `config-status.ts` docsUrl | Hardcode weatherapi.com | Generyczny „Weather provider” + docs z env/adapter metadata |

### 5.3 UI dostaje dane domenowe — nie surowy obiekt biblioteki

**BEFORE (UI zna kształt bliski API):**

```tsx
// ActionWeatherInfo — props = WeatherData (temp_max, precip, moon_phase…)
<p>{formatWeatherSummary(weather)}</p>
```

**AFTER (UI zna wynik domeny / gotowy view-model):**

```tsx
// props przygotowane w page loader / API DTO
interface ActionWeatherInfoProps {
  weather: { summary: string; details: { icon: WeatherDetailIcon; label: string }[] } | null;
}
// zero wiedzy o maxtemp_c, history.json, CDN vendora
```

Loader:

```ts
const snapshot = fromPersisted(row.weather_data);
const weatherVm = snapshot
  ? { summary: summaryLine(snapshot), details: detailLines(snapshot) }
  : null;
```

---

## KROK 6 — Weryfikacja i plan faz

### 6.1 Kryterium sukcesu (grep)

WeatherAPI **nie jest** pakietem npm — grep po vendorze:

```bash
rg -n "weatherapi\\.com|WeatherApiForecast|normalizeCityNameForWeatherApi|maxtemp_c|maxwind_kph|WEATHER_API_" src
```

**Po refaktorze dozwolone trafienia wyłącznie w:**

- `src/infrastructure/weather/**` (adapter + prywatne typy JSON)
- ewentualnie `src/infrastructure/weather/*.test.ts`
- `README.md` / `.env.example` (operacyjne secrets — poza runtime layers; docs mogą zostać)

**Niedozwolone po refaktorze:** `src/types.ts`, `src/components/**`, `src/pages/api/**` (poza ewentualnym `WEATHER_API_KEY` env wiring w composition root), `src/lib/plant-page.ts`, `src/lib/weather-display.ts`, `src/lib/plant-card-client.ts`.

### 6.2 Pliki: dziś znają → po refaktorze nie znają

| Plik | Dziś | Po ACL |
| --- | --- | --- |
| `src/types.ts` | Zna | **Nie** (usuń `WeatherData` vendor) |
| `src/lib/weather-display.ts` | Zna kształt | **Nie** vendora — tylko VO/view |
| `src/lib/plant-page.ts` | Zna `WeatherService` + `WeatherData` | **Nie** vendora — port + `fromPersisted` |
| `src/lib/plant-card-client.ts` | Zna `WeatherData` | **Nie** |
| `src/lib/city-validation.ts` | Zna `WeatherService` | **Nie** — zależy od portu |
| `src/lib/config-status.ts` | URL vendora | **Nie** (generyczny) |
| `src/pages/api/actions/index.ts` | Zna `WeatherService` | **Nie** — DI port |
| `src/pages/api/actions/[id].ts` | Zna | **Nie** |
| `src/pages/api/auth/signup.ts` | Zna key + city via service | Composition: port; brak URL/typów vendora |
| `src/pages/api/profile/setup.ts` | Zna | j.w. |
| `src/components/plants/ActionWeatherInfo.tsx` | Zna `WeatherData` | **Nie** |
| `src/components/plants/WeatherDetailList.astro` | Zna | **Nie** |
| `src/components/plants/GardenMapContextBar.astro` | Zna `TodayWeatherInfo` z lib/weather | **Nie** vendora |
| `src/lib/weather.ts` | Jest god-objectem | **Przeniesiony/skasowany** → `infrastructure/weather/WeatherApiComAdapter.ts` |
| `src/lib/weather.test.ts` | Fixture vendora | Przenieść obok adaptera |
| `src/infrastructure/weather/*` | — | **Jedyne** miejsce wiedzy o WeatherAPI.com |

### 6.3 Plan faz (konwencja jak w `02-invariant-aggregate-refactor.md`)

| Faza | Opis | Test-first? | Kryterium wyjścia |
| --- | --- | --- | --- |
| **0. Lock** | Potwierdzenie: WeatherSnapshot = kanon; legacy JSONB = migrate-on-read. Ustalenie katalogów `src/domain/weather`, `src/infrastructure/weather`. | — | Ten dokument zaakceptowany |
| **1. Domain core** | `WeatherSnapshot`, `toPersisted`/`fromPersisted` (v1 + legacy `{temp_max…}`), `summaryLine`/`detailLines`, port `WeatherProvider`. | **TAK** — unit Vitest (pure) | Zero importów `weatherapi` / `@supabase` w `src/domain/**` |
| **2. Adapter** | Przenieść HTTP z `WeatherService` → `WeatherApiComAdapter`; decyzje History/Forecast/1006/icon z KROK 3.4. | **TAK** — przenieść/mockować `weather.test.ts` przy adapterze | Adapter green; public API = port |
| **3. App wiring** | `actions` POST/PATCH, `city-validation`, `plant-page` today weather — zależą od portu; composition root podaje adapter. | Integration: create action z mockiem na krawędzi HTTP (jak test-plan #2) | API nie importuje typów `WeatherApi*` |
| **4. Persist shape** | Zapis nowych akcji jako `WeatherSnapshotPersistedV1`; read path akceptuje legacy. Opcjonalnie later: batch rewrite JSONB. | Unit `fromPersisted` legacy+v1 | Nowe inserty mają `"v": 1` |
| **5. UI thin** | `ActionWeatherInfo` / `WeatherDetailList` / `GardenMapContextBar` na view-model; usunąć importy `WeatherData` / `TodayWeatherInfo` z `@/lib/weather`. | Manual / istniejące integration ścieżki teaser | Grep vendora czysty poza infrastructure |
| **6. Cleanup** | Usunąć `WeatherData` z `types.ts`; rename `ERROR_CODES`; `config-status` generyczny; wpis w `lessons.md`. | — | Kryterium grep z 6.1 spełnione |

Fazy 1–3 są **test-first** zgodnie z `test-plan.md` (mock wyłącznie na krawędzi HTTP weather).

### 6.4 Load-bearing names

| Nazwa | Rodzaj | Kontrakt |
| --- | --- | --- |
| `WeatherSnapshot` | Value object | Kanon kształtu dnia pogodowego w domenie |
| `TodayWeather` | Value object / read model | Context bar „dziś” |
| `WeatherProvider` | Port | Jedyny interfejs I/O pogody |
| `WeatherApiComAdapter` | Adapter | Jedyny znawca `api.weatherapi.com` |
| `WeatherSnapshotPersistedV1` | Persistence DTO | JSONB `v: 1` + pola domenowe |
| `fromPersisted` | ACL mapper | Legacy WeatherAPI-shaped JSON → VO |
| `CityValidation` | Domain result | Bez kodów HTTP/1006 na zewnątrz adaptera |

### 6.5 Definition of Done (przyszła implementacja)

- [ ] `rg "weatherapi\\.com|WeatherApiForecast|maxtemp_c" src` → wyłącznie `src/infrastructure/weather/**`
- [ ] UI nie importuje `WeatherData` ani `TodayWeatherInfo` z legacy lib
- [ ] API routes zależą od `WeatherProvider`, nie od klasy HTTP
- [ ] Nowe `weather_data` JSONB mają `"v": 1` i pola domenowe
- [ ] Legacy wiersze nadal renderują teaser (migrate-on-read)
- [ ] Unit testy VO + adapter mock fetch green
- [ ] `npm run lint` + `npm run check` + `npm run test:integration` green
- [ ] Wpis w `lessons.md`: weather provider za ACL; UI nigdy nie czyta vendor JSON

---

## Powiązanie z wcześniejszymi dokumentami domenowymi

| Dokument | Relacja |
| --- | --- |
| `01-domain-distillation.md` | Weather = Supporting; ten plan daje Supportingowi granicę ACL, żeby nie korodował Core teasera |
| `02-invariant-aggregate-refactor.md` | Osobny wątek (Garden unique cell). Ten plan adresuje kandydat distillacji #3 (weather capture / provider boundary), nie I1 |
| `test-plan.md` risk #2 | ACL czyni krawędź mocka oczywistą: mock adapter / fetch w infrastructure, nie UI |

---

## Podsumowanie

Najgorszy przeciek to **WeatherAPI.com**: dokumenty (`roadmap.md:139`) deklarują wymienialność providera, a kod rozsmarował kształt odpowiedzi (pola, URL-e, CDN, kod 1006) przez `types`, API, read-model, UI i JSONB. `WeatherService` jest wrapperem HTTP, nie ACL — eksportuje `WeatherData`/`TodayWeatherInfo` jako kontrakt aplikacji. Supabase przecieka słabiej (głównie infra; wyjątek: typ `User` w UI) i nie ma deklaracji swap. Projekt ACL: value object `WeatherSnapshot` + port `WeatherProvider` + jedyny adapter `WeatherApiComAdapter`; UI dostaje view-model (summary/details), nie surowy JSON vendora. Wymiana providera ma wtedy dotykać wyłącznie katalogu infrastructure. Kryterium sukcesu: grep po `weatherapi.com` / typach `WeatherApi*` trafia tylko w adapter; plan faz 0–6 jest test-first jak w `02-invariant-aggregate-refactor.md`.
