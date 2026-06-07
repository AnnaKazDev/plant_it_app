# Weather API Integration — Plan Brief

> Full plan: `context/changes/weather-api-integration/plan.md`

## What & Why

Integrate WeatherAPI.com History API to enrich plant care actions with historical weather context (temperature, precipitation, sun/rain conditions). Weather data helps users understand how environmental conditions affected their plants over time, but remains optional — actions save successfully even if the weather API is unavailable.

## Starting Point

The `WeatherData` interface exists in `src/types.ts` but is unused. The `actions.weather_data` column (JSONB NULL) exists in the database from the F-01 milestone, ready to store weather snapshots. No weather service implementation exists yet. The project uses native `fetch()` for HTTP calls and follows Astro's `env` schema pattern for API secrets.

## Desired End State

Action creation can optionally fetch and cache historical weather data from WeatherAPI.com. The `src/lib/weather.ts` service provides a `getWeatherForDate(date, lat, lon, supabase)` method that checks the database cache first (reusing weather for same-day actions), falls back to the API, and returns `WeatherData | null`. Failed weather fetches never block action saves — the system gracefully stores `null` and continues. WeatherAPI.com API key is configured via Astro env, documented in README, and tested with mocked `fetch()`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Failure handling | Allow null weather_data | Actions must save successfully even when weather API is down — matches roadmap requirement for graceful degradation. | Plan |
| Caching strategy | DB-based cache (query first, API fallback) | Minimizes API calls (free tier: 1M/month) and speeds up same-day action creation by reusing weather data already stored in actions table. | Plan |
| Data fields | Extend current WeatherData interface | Stores all 11 fields defined in existing `WeatherData` type (temp_max, temp_min, wind, precip, humidity, sunrise, sunset, moonrise, moonset, moon_phase, condition) for future UI flexibility. | Plan |
| Testing approach | Integration tests with mocked fetch | Fast, deterministic tests covering all error paths without burning API quota — follows existing `upload.test.ts` pattern. | Plan |
| Rate limiting | No client throttling | Free tier (1M calls/month) is sufficient for single-user MVP; caching already reduces API usage significantly. | Plan |
| API choice | WeatherAPI.com | User has existing account; 1M/month free tier vs 1,000/day for OpenWeatherMap; historical data from 2010 onwards. | Roadmap |

## Scope

**In scope:**
- WeatherAPI.com History API integration using native `fetch()`
- DB-based caching (query `actions` table for existing `weather_data` before API call)
- Graceful null fallback when API is unavailable
- Service layer (`src/lib/weather.ts`) with `WeatherError` class and `WeatherService`
- Environment configuration (`WEATHER_API_KEY` in Astro env schema)
- Integration tests with mocked `fetch()` covering success + error paths
- Setup documentation in README

**Out of scope:**
- Real-time weather or forecast data (only historical via History API)
- Client-side rate limiting or throttling
- Retry logic for transient failures (single API call per action save)
- Background job queue for async weather fetching
- UI components to display weather (deferred to S-02 milestone)
- Bulk weather pre-fetching or batch API calls
- Weather for multiple locations (uses user's garden location only)

## Architecture / Approach

Service layer pattern (following `src/lib/storage.ts`):

1. **`src/lib/weather.ts`**: `WeatherService` class with three methods:
   - `getCachedWeather(date, supabase)` → queries `actions` table for existing `weather_data` matching date
   - `fetchWeatherForDate(date, lat, lon)` → calls WeatherAPI.com History API, maps response to `WeatherData`
   - `getWeatherForDate(date, lat, lon, supabase)` → **main entry point**: cache-first, API fallback
2. **Error handling**: All methods return `WeatherData | null` (no thrown exceptions)
3. **Env config**: `WEATHER_API_KEY` in Astro env schema, imported via `astro:env/server`
4. **Caching**: DB query (`SELECT weather_data FROM actions WHERE date = $1 AND weather_data IS NOT NULL LIMIT 1`) before API call

Future integration point (not in this plan): `/api/actions` POST endpoint will call `WeatherService.getWeatherForDate()` during action creation, save result to `actions.weather_data` column.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Foundation | Env config (`WEATHER_API_KEY`), service skeleton (`WeatherError`, `WeatherService` stubs), type extensions | Misconfigured env schema prevents import of `WEATHER_API_KEY` — verify with manual test in `.env` |
| 2. API Integration | Implement fetch + cache logic, parse History API response, map to `WeatherData`, handle all error paths | WeatherAPI.com response schema mismatch or undocumented fields — test with real API early |
| 3. Testing & Docs | Integration tests (mocked `fetch`), README setup instructions, config status check | Mocked tests pass but real API fails due to incorrect URL/params — include manual verification step with real key |

**Prerequisites:** WeatherAPI.com account created, API key available (user confirmed this is done: "mam już założone konto")  
**Estimated effort:** ~1-2 sessions across 3 phases (LOW complexity: straightforward API integration following established patterns)

## Open Risks & Assumptions

- **Risk**: WeatherAPI.com free tier rate limit (1M calls/month) could be hit if user bulk-imports 100+ historical actions. **Mitigation**: Caching reduces API calls significantly; free tier is generous for single-user MVP. Monitor usage via API dashboard.
- **Risk**: Cloudflare Workers CPU timeout (10-20ms budget) if weather API is slow. **Mitigation**: 5-second fetch timeout, null fallback ensures action save proceeds regardless.
- **Assumption**: User's garden location (from S-01 milestone) is sufficient for weather lookup (no per-plant location). Valid for hobby gardens where plants are within ~1 km.
- **Assumption**: Historical weather doesn't change, so cached data never needs invalidation. WeatherAPI.com may revise historical data, but risk is low for MVP.
- **Assumption**: Weather is "nice to have" enrichment, not core functionality. Actions with `null` weather_data are acceptable from user perspective. (Confirmed via roadmap requirement.)

## Success Criteria (Summary)

- Actions can be created with weather data populated from WeatherAPI.com when API is available
- Actions save successfully with `null` weather_data when API is unavailable (graceful degradation)
- DB caching works: second action on same date reuses cached weather (no duplicate API call)
- Integration tests pass with mocked `fetch()`, covering success + all error paths
- README documents WeatherAPI.com setup steps (signup, key, env config)
