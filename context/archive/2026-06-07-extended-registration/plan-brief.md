# Extended Registration — Plan Brief

> Full plan: `context/changes/extended-registration/plan.md`

## What & Why

Extend the existing email + password signup flow to collect location (city name), garden name (optional friendly label), and garden dimensions (width x height in meters), enabling downstream features that depend on user location (weather data for action teasers) and garden layout (spatial map view). The PRD requires garden location and dimensions at registration (FR-001, FR-012) because the core product value — visual plant story with weather context — cannot function without this data. Garden name prepares for future multi-garden support without over-engineering MVP.

## Starting Point

Minimal signup flow exists: email + password with client-side validation only, no server-side validation, no profile creation. The `profiles` table schema is ready (F-01 completed) with `location_lat`, `location_lng`, `garden_width`, `garden_height` columns, but no `location_city` or `garden_name` columns yet. WeatherAPI integration exists (`src/lib/weather.ts`) but only accepts lat/lng coordinates, not city names.

## Desired End State

Users register with email + password + city name + garden name (required friendly label) + garden dimensions (width, height in meters). After successful Supabase authentication, a profile row is created with `location_city`, `garden_name`, `garden_width`, `garden_height` populated. Client-side validation provides inline errors (e.g., "Width must be between 0.1 and 100 meters"), server-side zod validation catches malformed data, and WeatherAPI validates that the city name exists before profile insert. Garden name is required and allows users to label their garden ("My Garden", "Balcony", "Backyard") in MVP, preparing for future multi-garden support. If profile insert fails after auth succeeds, the user sees an error and can retry (orphaned auth account acceptable, handled in future enhancement).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Location input method | City name text input | WeatherAPI supports city name search directly (`q=city_name`), no geocoding API needed — fastest path to MVP. | Plan |
| Location storage | Add `location_city` TEXT column | Matches input UX and WeatherAPI usage; lat/lng columns exist but unused for now. | Plan |
| Garden name | Add `garden_name` TEXT column (required) | Allows users to label their garden in MVP; prepares for future multi-garden support without over-engineering now. | Plan |
| Field requirements | All required including garden_name | Weather API needs location, garden map needs dimensions, garden name distinguishes multiple gardens in future — partial profiles break downstream features. | Plan |
| Validation strategy | Both client + server (zod) | Follows photo upload API pattern (best practice); prevents DB constraint violations. | Plan |
| Profile creation timing | In signup API after auth.signUp | Atomic from user perspective — one request completes both auth and profile setup. | Plan |
| Profile insert failure handling | Show error, allow retry | User can fix issue and retry; orphaned auth accounts handled later. | Plan |
| Garden dimensions range | 0.1m – 100m | Covers balcony gardens to large plots; matches schema precision DECIMAL(5,2). | Plan |
| City name validation | Validate via WeatherAPI call | Catches typos/invalid cities before profile insert with immediate feedback. | Plan |
| Form UX | Placeholders and hints | Clear guidance reduces confusion — e.g., "e.g., Warsaw", "Width of your garden in meters". | Plan |

## Scope

**In scope:**
- Add `location_city` and `garden_name` TEXT columns to profiles table via migration
- Add WeatherAPI city validation method (`validateCityName`)
- Extend signup form with 4 new fields: city, garden name (optional), width, height
- Client-side validation for all fields (inline errors as user types; garden name optional)
- Server-side zod validation following photo upload API pattern
- Create profile row after successful auth.signUp
- Error handling: show errors and allow retry if profile insert fails

**Out of scope:**
- Geocoding city to lat/lng coordinates at signup (lat/lng columns remain NULL)
- Interactive map picker or autocomplete dropdown for cities
- Database trigger to auto-create profiles
- Rollback mechanism to delete auth.users if profile fails
- Settings page to edit profile later
- Middleware check to redirect users with no profile to complete-profile page
- Unit or integration tests (manual testing covers MVP scope)

## Architecture / Approach

Traditional form POST flow: React island validates client-side → POSTs to `/api/auth/signup` → server validates with zod → calls `supabase.auth.signUp()` → validates city via WeatherAPI → inserts profile row → redirects to confirm-email or back to signup with error. City validation uses WeatherAPI's `current.json` endpoint (cheapest/fastest) with 5s timeout. Profile creation is NOT atomic with auth (no DB trigger or rollback) — if profile insert fails, auth account exists (orphaned) but user can retry. Future enhancement: middleware detects missing profile and redirects to complete-profile page.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Database schema extension | `location_city` and `garden_name` TEXT columns in profiles table | None — additive migration, rollback safe |
| 2. WeatherAPI city validation | `validateCityName()` method in WeatherService | WeatherAPI rate limit or downtime breaks validation; timeout mitigates |
| 3. Signup form extension | 4 new fields (city, garden name, width, height) with client validation | FormField component is string-only — using `type="number"` with string value may cause conversion issues |
| 4. Signup API enhancement | Zod validation + profile insert + error handling | Profile insert fails after auth succeeds → orphaned auth.users row (acceptable, handled in future) |
| 5. Testing & verification | Manual testing of full flow + edge cases | Comprehensive manual testing required — no automated tests yet |

**Prerequisites:** F-01 (core-data-schema) completed. WEATHER_API_KEY env var configured.

**Estimated effort:** ~1-2 sessions across 5 phases. Each phase has clear automated + manual verification. Pause between phases for manual confirmation before proceeding.

## Open Risks & Assumptions

**Risks:**
- **WeatherAPI rate limit** — Free tier is 1M requests/month; city validation adds ~1 call per signup. For MVP (<100 signups/day), this is negligible, but monitor usage. Mitigation: add caching layer (validated city names in Redis/DB for 24h) if approaching limit.
- **WeatherAPI downtime** — If API is unavailable, signup breaks. Mitigation: 5s timeout returns error gracefully; user can retry later.
- **Orphaned auth accounts** — If profile insert fails after auth succeeds, auth.users row exists but profile doesn't. User sees error and can retry, but account is orphaned. Mitigation: future enhancement adds middleware check for missing profile and redirects to complete-profile page.

**Assumptions:**
- Users understand city names (no autocomplete or guidance beyond placeholder)
- WeatherAPI can handle all reasonable city name variations (special characters, spaces)
- Hobby gardeners' gardens fit within 0.1m – 100m range (excludes industrial/farm-scale)
- Manual testing is sufficient for MVP — no automated tests required yet
- Form submission latency (~500ms for WeatherAPI validation) is acceptable for infrequent operation

## Success Criteria (Summary)

- User completes signup with valid email, password, city ("Warsaw"), garden name ("My Balcony"), and dimensions (5.5m x 8.0m) → redirected to confirm-email → profile row exists with correct data including optional garden_name
- Invalid city ("XYZ123NotACity") → shows error "City not found or could not be validated" → user fixes city → retry succeeds
- Dimensions outside 0.1–100m range → client validation blocks submit with inline error
- All client validation errors display correctly (empty fields, invalid email, short password, mismatched passwords, invalid dimensions)
- Server validation catches malformed data (manipulated request with width=101) and returns error
- Profile insert failure → shows error "Failed to create profile" → auth account exists (orphaned) → user can retry
