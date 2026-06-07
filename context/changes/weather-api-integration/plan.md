# Weather API Integration Implementation Plan

## Overview

Integrate WeatherAPI.com History API to fetch and cache historical weather data (temperature, precipitation, conditions) for plant care actions. Weather enriches action teasers but remains optional — actions save successfully even if weather API is unavailable.

## Current State Analysis

### What exists now

- `WeatherData` interface defined in `src/types.ts` (lines 23-38) but unused in application code
- `actions.weather_data` column exists as `JSONB NULL` in database (migration `20260604120000_core_data_schema.sql`)
- No weather service implementation
- No WeatherAPI.com integration
- API key management pattern established via Astro `env` schema (`SUPABASE_URL`, `SUPABASE_KEY` in `astro.config.mjs`)
- Error handling patterns: `StorageError` in `src/lib/storage.ts`, `ApiError` in `src/types.ts`

### Key Discoveries:

- Project uses native `fetch()` for HTTP (no axios/ky in `package.json`)
- WeatherAPI.com free tier: 1M calls/month (1,370/hour average) — sufficient for MVP
- History API endpoint: `http://api.weatherapi.com/v1/history.json?key={KEY}&q={lat},{lon}&dt={YYYY-MM-DD}`
- Response structure: `forecast.forecastday[0].day` contains aggregated daily weather
- Codebase pattern: service layer in `src/lib/`, API routes in `src/pages/api/`
- User profile includes `location` (city/coordinates) and `garden_width`/`garden_height` (from S-01 milestone)

### Constraints discovered

- Cloudflare Workers deployment: CPU time budget 10-20ms per request (measured in existing impl-review)
- WeatherAPI.com requires API key authentication via query parameter
- Rate limits: 1M calls/month free tier (can be exceeded with bulk imports)
- Historical data available from 2010-01-01 onwards only
- Action creation flow should not block on weather fetch failure

## Desired End State

A working weather integration where:

1. **Service layer** (`src/lib/weather.ts`) fetches historical weather from WeatherAPI.com, caches results in database, handles errors gracefully
2. **API key** (`WEATHER_API_KEY`) is configured in Astro env schema and local `.env` / `.dev.vars`
3. **Error handling** allows actions to save with `null` weather_data if API is unavailable
4. **Testing** covers success path, error paths (network failure, 404, 500), and caching logic using mocked `fetch()`
5. **Documentation** includes setup instructions (API key registration, local config)

When complete, action creation can optionally fetch weather data, but core functionality (saving plant care actions) never depends on weather API availability.

## What We're NOT Doing

- Storing full raw API response (only fields defined in `WeatherData` interface)
- Client-side rate limiting or throttling (relying on generous 1M/month free tier)
- Real-time weather / forecasts (only historical data via History API)
- Weather data for locations outside user's configured garden location
- UI components to display weather (that's S-02 milestone)
- Background job queue for async weather fetching
- Retry logic for transient failures (single API call, graceful null fallback)
- Bulk weather pre-fetching or batch API calls

## Implementation Approach

Three-phase approach following established codebase patterns:

1. **Foundation**: Add API key to env schema, create service layer (`src/lib/weather.ts`) with `WeatherService` class, implement caching logic (DB query before API call)
2. **Integration**: Extend `src/types.ts` with refined `WeatherData` mapping, add error codes, implement History API client with `fetch()`
3. **Testing & Docs**: Mock-based integration tests, update `.env.example` / `.dev.vars.example`, document API key setup

DB-based caching strategy: Before calling WeatherAPI.com, query `actions` table for existing `weather_data` matching `(date, location)` — reuse if found. This minimizes API calls when multiple actions occur on same day.

Graceful degradation: All weather service methods return `WeatherData | null`. Callers (future action creation API route) handle `null` by saving action with `weather_data: null`.

## Critical Implementation Details

### Timing & lifecycle

- Weather fetch happens **during action creation** (server-side, in future `/api/actions` POST endpoint)
- DB cache check **precedes** API call to minimize latency
- Cache hit path (DB query + JSON parse) should complete in <10ms
- API call path (fetch + parse + DB write) budget: 100-200ms max (avoid Cloudflare CPU timeout)
- Action save proceeds **regardless** of weather fetch outcome (null is valid)

### User experience spec

- No user-visible weather loading state (fetch happens server-side, synchronously blocks action creation request)
- If weather fetch fails, action saves successfully with `weather_data: null` — no error shown to user
- UI (future S-02) will handle `null` weather gracefully (show placeholder or omit weather teaser)

### Performance constraints

- Cloudflare Workers: keep total CPU time per request under 10ms (current measurement: 18-20ms for auth routes)
- Cache check query must use indexed column for fast lookup (consider adding composite index on `(date, weather_data)` if cache misses are slow)
- WeatherAPI.com free tier: 1M calls/month = ~1,370/hour average; no client throttling needed for single-user MVP, but log API usage for monitoring

### State sequencing

1. Receive action creation request with `date` + `plant_id` (plant has associated user → user has `location`)
2. Check DB cache: `SELECT weather_data FROM actions WHERE date = $1 AND weather_data IS NOT NULL LIMIT 1`
3. If cache hit: return parsed `WeatherData`, skip API call
4. If cache miss: call WeatherAPI.com History API with `(date, location)`
5. On success: return `WeatherData`, save action with populated `weather_data`
6. On failure: return `null`, save action with `weather_data: null`

Cache invalidation: none needed (historical weather doesn't change). Cache is read-only.

## Phase 1: Foundation - Environment & Service Skeleton

### Overview

Set up API key configuration, create weather service skeleton with error handling class, establish caching foundation.

### Changes Required:

#### 1. Environment Configuration

**File**: `astro.config.mjs`

**Intent**: Add `WEATHER_API_KEY` to Astro env schema as server-only secret so it's available via `astro:env/server` import pattern (matching existing `SUPABASE_URL`/`SUPABASE_KEY` convention).

**Contract**: Add new entry to `env.schema` object:

```javascript
env: {
  schema: {
    SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
    SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    WEATHER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
  },
}
```

#### 2. Local Development Environment Templates

**File**: `.env.example`

**Intent**: Document `WEATHER_API_KEY` for Node.js / Supabase CLI workflows so developers know to add it to local `.env`.

**Contract**: Append line:

```
WEATHER_API_KEY=[your-weatherapi.com-key]
```

**File**: `.dev.vars.example`

**Intent**: Document `WEATHER_API_KEY` for Cloudflare Workers local dev (`wrangler dev`) so developers know to add it to `.dev.vars`.

**Contract**: Append line:

```
WEATHER_API_KEY=[your-weatherapi.com-key]
```

#### 3. Weather Service Module

**File**: `src/lib/weather.ts` (new)

**Intent**: Create service module with `WeatherError` class (mirroring `StorageError` pattern from `src/lib/storage.ts`), skeleton `WeatherService` class with placeholder methods `fetchWeatherForDate()` and `getCachedWeather()`.

**Contract**: Export class and error:

```typescript
export class WeatherError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "WeatherError";
  }
}

export class WeatherService {
  constructor(private apiKey: string) {}
  
  async fetchWeatherForDate(
    date: string,
    latitude: number,
    longitude: number
  ): Promise<WeatherData | null> {
    // Phase 2 implementation
    return null;
  }
  
  async getCachedWeather(
    date: string,
    supabase: SupabaseClient<Database>
  ): Promise<WeatherData | null> {
    // Phase 2 implementation
    return null;
  }
}
```

Import `WeatherData` from `@/types`, `SupabaseClient` and `Database` from `@supabase/supabase-js` and `@/types`.

#### 4. Type Extensions

**File**: `src/types.ts`

**Intent**: Extend `ERROR_CODES` constant with weather-related error codes for use in API error responses.

**Contract**: Add to existing `ERROR_CODES` object (line ~58):

```typescript
export const ERROR_CODES = {
  // ... existing codes ...
  WEATHER_API_UNAVAILABLE: "WEATHER_API_UNAVAILABLE",
  WEATHER_API_INVALID_KEY: "WEATHER_API_INVALID_KEY",
  WEATHER_API_RATE_LIMIT: "WEATHER_API_RATE_LIMIT",
} as const;
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (or `npx astro check`)
- Linting passes: `npm run lint`
- `src/lib/weather.ts` exists and exports `WeatherError`, `WeatherService`
- `astro.config.mjs` declares `WEATHER_API_KEY` in env schema
- `.env.example` and `.dev.vars.example` both document `WEATHER_API_KEY`

#### Manual Verification:

- Import `{ WEATHER_API_KEY } from "astro:env/server"` in a test file — no TypeScript error
- Create `.env` with real WeatherAPI.com key, run `npm run dev` — server starts without env errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that manual testing was successful before proceeding to Phase 2.

---

## Phase 2: API Integration - Fetch & Cache Logic

### Overview

Implement weather fetch from WeatherAPI.com History API, add DB caching layer, handle all error paths.

### Changes Required:

#### 1. Weather Service Implementation

**File**: `src/lib/weather.ts`

**Intent**: Implement `fetchWeatherForDate()` method to call WeatherAPI.com History API using native `fetch()`, parse response, map to `WeatherData` interface, handle errors (network failure, 401, 403, 404, 500, invalid response schema).

**Contract**: Method signature (already in skeleton):

```typescript
async fetchWeatherForDate(
  date: string,
  latitude: number,
  longitude: number
): Promise<WeatherData | null>
```

Implementation details:
- Construct URL: `http://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${lat},${lon}&dt=${date}` (date format: YYYY-MM-DD)
- Call `fetch()`, set timeout (e.g., 5 seconds via `AbortController`)
- Check `response.ok`, handle 401/403 (invalid key), 400 (invalid params), 404 (no data), 500 (server error)
- Parse JSON response, extract `forecast.forecastday[0].day` object
- Map API fields to `WeatherData` interface:
  - `temp_max` ← `day.maxtemp_c`
  - `temp_min` ← `day.mintemp_c`
  - `wind` ← `day.maxwind_kph`
  - `precip` ← `day.totalprecip_mm`
  - `humidity` ← `day.avghumidity`
  - `sunrise` ← `astro.sunrise`
  - `sunset` ← `astro.sunset`
  - `moonrise` ← `astro.moonrise`
  - `moonset` ← `astro.moonset`
  - `moon_phase` ← `astro.moon_phase`
- On any error (network, timeout, bad JSON, missing fields): return `null` (graceful degradation — do NOT throw)
- Log errors for debugging but don't propagate exceptions

#### 2. Cache Query Implementation

**File**: `src/lib/weather.ts`

**Intent**: Implement `getCachedWeather()` method to query `actions` table for existing `weather_data` matching the given date, return parsed `WeatherData` if found, else `null`.

**Contract**: Method signature (already in skeleton):

```typescript
async getCachedWeather(
  date: string,
  supabase: SupabaseClient<Database>
): Promise<WeatherData | null>
```

Implementation details:
- Query: `supabase.from("actions").select("weather_data").eq("date", date).not("weather_data", "is", null).limit(1).single()`
- If `data` exists and `weather_data` is truthy: parse as `WeatherData`, return
- If error or no data: return `null`
- Note: assumes `weather_data` JSON structure matches `WeatherData` interface (no schema version check needed for MVP)

#### 3. Unified Fetch-or-Cache Helper

**File**: `src/lib/weather.ts`

**Intent**: Add high-level helper method `getWeatherForDate()` that wraps caching + fetch logic: check cache first, fallback to API, return `WeatherData | null`.

**Contract**: Export new method:

```typescript
async getWeatherForDate(
  date: string,
  latitude: number,
  longitude: number,
  supabase: SupabaseClient<Database>
): Promise<WeatherData | null> {
  // 1. Check cache
  const cached = await this.getCachedWeather(date, supabase);
  if (cached) return cached;
  
  // 2. Fetch from API
  return await this.fetchWeatherForDate(date, latitude, longitude);
}
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- `WeatherService` methods implemented (no empty stubs)
- `fetchWeatherForDate()` returns `WeatherData | null`
- `getCachedWeather()` queries `actions` table correctly

#### Manual Verification:

- Create a test script that calls `WeatherService.getWeatherForDate()` with real API key + date + coordinates from WeatherAPI.com account location
- Verify returned `WeatherData` object has all required fields populated
- Second call with same date returns cached result (no second API call — verify via console log or API dashboard)
- Invalid date (future date beyond 14 days or before 2010-01-01) returns `null` gracefully
- Invalid API key returns `null` without throwing error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that manual testing was successful before proceeding to Phase 3.

---

## Phase 3: Testing & Documentation

### Overview

Add comprehensive integration tests with mocked `fetch()`, update documentation for setup instructions.

### Changes Required:

#### 1. Integration Tests

**File**: `src/lib/weather.test.ts` (new)

**Intent**: Write Vitest integration tests covering success path, error paths (network failure, 404, 401, 500, malformed JSON), and caching logic. Mock global `fetch()` to return fixture responses (following pattern from `src/pages/api/photos/upload.test.ts`).

**Contract**: Test cases:

- ✅ `fetchWeatherForDate()` success path: mock fetch returns valid History API response → returns parsed `WeatherData`
- ✅ `fetchWeatherForDate()` network error: mock fetch rejects → returns `null`
- ✅ `fetchWeatherForDate()` 401 Unauthorized (invalid key): mock fetch returns 401 → returns `null`
- ✅ `fetchWeatherForDate()` 404 Not Found (no data for date): mock fetch returns 404 → returns `null`
- ✅ `fetchWeatherForDate()` 500 Server Error: mock fetch returns 500 → returns `null`
- ✅ `fetchWeatherForDate()` malformed JSON: mock fetch returns non-JSON or missing `forecast.forecastday` → returns `null`
- ✅ `getCachedWeather()` cache hit: seed action with `weather_data`, query returns it → returns parsed `WeatherData`
- ✅ `getCachedWeather()` cache miss: no matching actions → returns `null`
- ✅ `getWeatherForDate()` uses cache first: seed action, call → should NOT call API (assert fetch mock not called)
- ✅ `getWeatherForDate()` fallback to API: no cache, mock fetch succeeds → returns API data

Use Vitest's `vi.fn()` to mock `fetch`, `vi.spyOn(global, 'fetch')` pattern. Seed test data via `src/lib/test-utils.ts` helpers (`seedTestData`, `cleanupTestData`).

#### 2. Test Configuration

**File**: `vitest.config.ts`

**Intent**: Ensure test environment has access to `WEATHER_API_KEY` env var (for manual verification tests, not mocked tests). No changes needed if existing config already loads `.env` via `src/lib/test-setup.ts`.

**Contract**: Verify `test-setup.ts` imports `dotenv/config` (already present at line 1).

#### 3. Setup Documentation

**File**: `README.md`

**Intent**: Add section documenting WeatherAPI.com integration setup steps: account signup, API key retrieval, local config, verification.

**Contract**: Add new section (suggest placement after "Environment & Secrets" or similar):

```markdown
### WeatherAPI.com Setup

1. Sign up for free account at https://weatherapi.com/signup.aspx
2. Get API key from https://www.weatherapi.com/my/ (Dashboard → "Your API Key")
3. Add to local environment:
   - Node.js / Supabase CLI: `WEATHER_API_KEY=your-key-here` in `.env`
   - Cloudflare Workers local dev: `WEATHER_API_KEY=your-key-here` in `.dev.vars`
4. For production deployment: `npx wrangler secret put WEATHER_API_KEY` (Cloudflare Workers)
5. For CI: Add `WEATHER_API_KEY` to GitHub repository secrets

Free tier: 1M calls/month. Historical weather available from 2010-01-01 onwards.

Verify setup: Run `npm run test` — weather integration tests should pass.
```

#### 4. Configuration Status Extension

**File**: `src/lib/config-status.ts`

**Intent**: Add weather API key check to `configStatuses` array so `/dashboard` or health check endpoint can report whether weather integration is configured (following pattern of existing Supabase checks).

**Contract**: Add to `configStatuses` array (line ~10):

```typescript
{
  name: "Weather API",
  key: "weather_api",
  status: WEATHER_API_KEY ? "configured" : "missing",
  message: WEATHER_API_KEY 
    ? "Weather API key configured" 
    : "Weather API key missing - add WEATHER_API_KEY to environment",
}
```

Import `WEATHER_API_KEY` from `astro:env/server` at top of file.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test:integration`
- `src/lib/weather.test.ts` has 10+ test cases (success + error paths + cache)
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- `config-status.ts` includes weather API check

#### Manual Verification:

- Run tests with real API key in `.env` (optional verification test, not mocked): weather fetch succeeds
- Run tests without API key: mocked tests still pass (don't depend on real key)
- Check `README.md` includes WeatherAPI.com setup instructions
- Visit `/dashboard` (future route): weather API status appears in config health check UI

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that manual testing was successful.

---

## Testing Strategy

### Integration Tests:

- Mock-based tests in `src/lib/weather.test.ts` covering:
  - API success path with valid response fixture
  - All error paths (network, 401, 403, 404, 500, malformed JSON)
  - Cache hit/miss scenarios using seeded test data
  - `getWeatherForDate()` composition (cache-first, API fallback)
- Use `vi.fn()` to mock global `fetch`, assert calls/no-calls for cache verification
- Seed test data via `test-utils.ts` helpers (`seedTestData`, `cleanupTestData`)

### Manual Testing Steps:

1. **Setup verification**: Add real WeatherAPI.com key to `.env`, run `npm run dev`, check server starts without errors
2. **API fetch test**: Create test script calling `WeatherService.getWeatherForDate()` with real key + past date (e.g., 2024-01-15) + valid coordinates → verify returns `WeatherData` with populated fields
3. **Cache test**: Run same call twice → second call should skip API (verify via API dashboard "API Calls" counter or console log)
4. **Error handling test**: Use invalid API key → verify returns `null` without crashing
5. **Graceful degradation test**: Disconnect network or use non-existent date (before 2010) → verify returns `null`

## Performance Considerations

- **Cache-first strategy**: DB query for existing `weather_data` before API call reduces latency and API usage
- **Single API call per action save**: no retry logic or background jobs (keeps CPU time low on Cloudflare Workers)
- **Timeout on fetch**: 5-second abort signal prevents hanging requests
- **Graceful null fallback**: failed weather fetch does not block action creation or increase error rate
- **Free tier quota**: 1M calls/month = ~1,370/hour average; single-user MVP with caching should use <1000 calls/month

Consider monitoring API usage via WeatherAPI.com dashboard during initial deployment. If approaching free tier limits, can add more aggressive caching (e.g., cache by rounded coordinates to group nearby locations).

## Migration Notes

Not applicable — no database schema changes needed. `actions.weather_data` column (JSONB NULL) already exists from F-01 milestone.

Existing actions with `weather_data: null` remain unchanged. Future action creation will populate weather if API is available.

## References

- WeatherAPI.com documentation: https://www.weatherapi.com/docs/
- History API endpoint: https://www.weatherapi.com/docs/#apis-history
- Roadmap: `context/foundation/roadmap.md` (F-03 milestone, lines 119-131)
- Existing service pattern: `src/lib/storage.ts`
- Existing error pattern: `src/types.ts` (`ApiError`, `ERROR_CODES`)
- Codebase conventions: `AGENTS.md`, `CLAUDE.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation - Environment & Service Skeleton

#### Automated

- [x] 1.1 Type checking passes (`npm run build`) — d279a69
- [x] 1.2 Linting passes (`npm run lint`) — d279a69
- [x] 1.3 `src/lib/weather.ts` exists and exports `WeatherError`, `WeatherService` — d279a69
- [x] 1.4 `astro.config.mjs` declares `WEATHER_API_KEY` in env schema — d279a69
- [x] 1.5 `.env.example` and `.dev.vars.example` document `WEATHER_API_KEY` — d279a69

#### Manual

- [x] 1.6 Import `WEATHER_API_KEY` from `astro:env/server` in test file — no TypeScript error — d279a69
- [x] 1.7 Create `.env` with real key, run `npm run dev` — server starts without env errors — d279a69

### Phase 2: API Integration - Fetch & Cache Logic

#### Automated

- [x] 2.1 Type checking passes (`npm run build`) — 13d4b47
- [x] 2.2 Linting passes (`npm run lint`) — 13d4b47
- [x] 2.3 `WeatherService` methods implemented (no empty stubs) — 13d4b47
- [x] 2.4 `fetchWeatherForDate()` returns `WeatherData | null` — 13d4b47
- [x] 2.5 `getCachedWeather()` queries `actions` table correctly — 13d4b47

#### Manual

- [x] 2.6 Test script calls `getWeatherForDate()` with real key + date + coordinates → returns `WeatherData` — 13d4b47
- [x] 2.7 Second call with same date returns cached result (no second API call) — 13d4b47
- [x] 2.8 Invalid date returns `null` gracefully — 13d4b47
- [x] 2.9 Invalid API key returns `null` without throwing error — 13d4b47

### Phase 3: Testing & Documentation

#### Automated

- [x] 3.1 All tests pass: `npm run test:integration` — 6903f16
- [x] 3.2 `src/lib/weather.test.ts` has 10+ test cases — 6903f16
- [x] 3.3 Type checking passes: `npm run build` — 6903f16
- [x] 3.4 Linting passes: `npm run lint` — 6903f16
- [x] 3.5 `config-status.ts` includes weather API check — 6903f16

#### Manual

- [x] 3.6 Run tests with real API key: weather fetch succeeds (optional verification) — 6903f16
- [x] 3.7 Run tests without API key: mocked tests still pass — 6903f16
- [x] 3.8 `README.md` includes WeatherAPI.com setup instructions — 6903f16
- [ ] 3.9 Visit `/dashboard`: weather API status appears in config health check UI
