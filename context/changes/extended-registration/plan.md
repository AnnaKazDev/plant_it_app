# Extended Registration Implementation Plan

## Overview

Extend the existing signup flow to collect location (city name), garden name, and garden dimensions (width x height in meters) alongside email and password. Validate inputs both client-side (inline errors) and server-side (zod schema), call WeatherAPI to verify city name exists, and create a profile row in the database after successful Supabase authentication.

## Current State Analysis

**Existing signup flow (email + password only):**
- Form: `src/components/auth/SignUpForm.tsx` - React form with client-side validation, traditional POST to API
- Form component: `src/components/auth/FormField.tsx` - reusable labeled input (currently string-only, no number type)
- API: `src/pages/api/auth/signup.ts` - reads formData, calls `supabase.auth.signUp({ email, password })`, redirects to confirm-email on success or back to signup with error query param on failure
- Validation: client-side only (regex for email, min 6 chars for password); no server-side validation or zod
- Profile creation: NOT wired - auth.users row is created but no profile row is inserted

**Database schema:**
- `profiles` table exists (F-01 migration `supabase/migrations/20260604120000_core_data_schema.sql` lines 5-13)
- Current columns: `id UUID`, `location_lat DECIMAL(9,6)`, `location_lng DECIMAL(9,6)`, `garden_width DECIMAL(5,2)`, `garden_height DECIMAL(5,2)`, `created_at`, `updated_at`
- Constraints: `garden_width > 0`, `garden_height > 0`, both nullable
- RLS policies: per-user CRUD (lines 76-79)
- **Gap:** no `location_city` TEXT or `garden_name` TEXT columns for storing city names and garden names

**WeatherAPI integration:**
- Service: `src/lib/weather.ts` - WeatherService class with `fetchWeatherForDate(date, lat, lng)` method
- Current implementation: accepts lat/lng coordinates, calls `http://api.weatherapi.com/v1/history.json?key=...&q={lat},{lng}&dt={date}`
- **Gap:** no method to validate city names (WeatherAPI supports `q=city_name` but not used yet)

**Validation patterns:**
- Auth forms: client-side validation only (SignUpForm, SignInForm) with inline error state
- Photo upload API: server-side zod validation (`src/pages/api/photos/upload.ts` lines 14-17, 50-66) with structured JSON error responses using `ERROR_CODES` from `src/types.ts`

### Key Discoveries:

- WeatherAPI.com supports city name search directly via `q=city_name` parameter (e.g., `q=Warsaw`) - no separate geocoding API needed
- FormField component is string-only (`value: string`, `onChange: (value: string) => void`) - can be reused for city input but need number inputs for dimensions
- Photo upload API is the best pattern to follow for server-side validation (zod + structured errors)
- Current signup API has no `export const prerender = false` (unlike photo upload API line 8) - should be added for consistency
- No database trigger to create profile on signup - need to insert manually in API handler

## Desired End State

Users can register with:
- Email + password (existing)
- City name (new) - validated against WeatherAPI locations
- Garden name (new) - optional friendly name for their garden (e.g., "My Garden", "Balcony", "Backyard")
- Garden dimensions: width and height in meters (new) - validated range 0.1m – 100m

After successful signup:
- auth.users row exists (email + password)
- profiles row exists with `location_city`, `garden_name`, `garden_width`, `garden_height` populated
- User is redirected to `/auth/confirm-email`
- If profile insert fails after auth succeeds, user sees error and can retry (orphaned auth.users row acceptable, handled on next login)

**Verification:**
- Signup form shows 6 fields: email, password, confirm password, city, garden name, width, height
- Client validation shows inline errors for invalid inputs before submit
- Server validates via zod and returns structured errors if invalid
- City name is verified against WeatherAPI (call returns 200) before profile insert
- Profile row contains correct data after successful signup
- Invalid city name shows error: "City not found"
- Dimensions outside 0.1–100 range show validation errors

## What We're NOT Doing

- Geocoding city to lat/lng coordinates at signup (lat/lng columns remain NULL for now; weather API uses city name directly)
- Interactive map picker for location
- Autocomplete dropdown for cities
- Modifying existing users/profiles - only affecting new signups
- Database trigger to auto-create profiles
- Rollback mechanism to delete auth.users if profile fails (complexity vs value tradeoff)
- Settings page to edit profile later (separate feature)

## Implementation Approach

**High-level strategy:**
1. Schema first - add `location_city` and `garden_name` columns so profile insert has targets
2. WeatherAPI validation method - validate city names before extending signup (testable in isolation)
3. UI extension - add form fields with client validation following existing FormField pattern
4. API enhancement - add zod validation, profile insert, error handling following photo upload API pattern
5. Manual testing - verify full flow including error paths

**Key decision:** Store city name as TEXT rather than geocoding to lat/lng at signup - simpler, faster, WeatherAPI supports city names natively. Lat/lng columns exist but remain NULL until a future feature needs them (e.g., distance calculations). Garden name is optional friendly label for MVP single-garden setup; prepares for future multi-garden support without over-engineering now.

## Critical Implementation Details

**Timing & lifecycle:**
- Profile insert MUST happen AFTER `supabase.auth.signUp()` succeeds but BEFORE redirecting to `/auth/confirm-email`. If profile insert fails, do NOT redirect - stay on `/auth/signup` with error query param so user can retry. The auth.users row will exist (orphaned), but this is acceptable - users can log in and will be prompted to complete profile (future enhancement).

**State sequencing:**
- Validation order: client validates first (on submit) → if pass, server validates (zod in API) → if pass, auth.signUp → if pass, profile insert → if pass, redirect to confirm-email. Do NOT call WeatherAPI for city validation until after zod validation passes (avoids rate limit waste on malformed inputs).

## Phase 1: Database Schema Extension

### Overview

Add `location_city` and `garden_name` TEXT columns to profiles table to store user-provided city names and garden names.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/[timestamp]_add_location_city_to_profiles.sql`

**Intent**: Add two nullable TEXT columns to store city names and garden names. Nullable because existing profiles (if any) won't have this data, and we want migration to succeed. Garden name allows users to give their garden a friendly name in MVP (single garden), preparing for future multi-garden support.

**Contract**: New columns `location_city TEXT` and `garden_name TEXT` added to `public.profiles` table.

```sql
ALTER TABLE public.profiles
ADD COLUMN location_city TEXT,
ADD COLUMN garden_name TEXT;
```

#### 2. Regenerate TypeScript types

**File**: `src/database.types.ts` (generated)

**Intent**: Update database types to include the new `location_city` and `garden_name` columns so TypeScript recognizes them in Profile type.

**Contract**: Run `npx supabase gen types typescript --local > src/database.types.ts` after migration applies.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up`
- TypeScript build passes: `npm run build`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- Query profiles table shows `location_city` and `garden_name` columns: `SELECT * FROM profiles LIMIT 1;`
- `src/database.types.ts` contains `location_city?: string | null` and `garden_name?: string | null` in `profiles` table type

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: WeatherAPI City Validation

### Overview

Add a method to WeatherService to validate city names by calling WeatherAPI. This will be used during signup form submission to verify the city exists before creating a profile.

### Changes Required:

#### 1. WeatherService class

**File**: `src/lib/weather.ts`

**Intent**: Add `validateCityName(cityName: string)` method that calls WeatherAPI to check if the city exists. Returns true if city is valid, false otherwise.

**Contract**: New public method `validateCityName(cityName: string): Promise<boolean>`. Calls `http://api.weatherapi.com/v1/current.json?key={apiKey}&q={cityName}` (current weather endpoint is cheapest/fastest for validation). Returns true if response is 200 OK, false if 400/404 or network error. Uses 5-second timeout like existing `fetchWeatherForDate`.

```typescript
async validateCityName(cityName: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    const url = `http://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${encodeURIComponent(cityName)}`;

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch {
    return false;
  }
}
```

#### 2. Error codes

**File**: `src/types.ts`

**Intent**: Add error codes for city validation failures so API can return structured errors.

**Contract**: Add to `ERROR_CODES` constant (line 63):

```typescript
export const ERROR_CODES = {
  // ... existing codes
  INVALID_CITY: "INVALID_CITY",
  CITY_VALIDATION_FAILED: "CITY_VALIDATION_FAILED",
} as const;
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Test valid city: create a test script that calls `weatherService.validateCityName("Warsaw")` → returns `true`
- Test invalid city: call `weatherService.validateCityName("XYZ123NotACity")` → returns `false`
- Test network timeout: temporarily set timeout to 1ms → returns `false` gracefully

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Signup Form Extension

### Overview

Add four new form fields to SignUpForm: city name (text input), garden name (text input), garden width (number input), garden height (number input). Add client-side validation for all fields following existing pattern. Display helpful placeholders and hints.

### Changes Required:

#### 1. FormField component (optional enhancement)

**File**: `src/components/auth/FormField.tsx`

**Intent**: Currently FormField only accepts `type?: string` and `value: string`. To support number inputs properly, either (a) keep as-is and let HTML input handle type="number" with string value conversion, or (b) make it generic to accept `value: string | number`. Option (a) is simpler.

**Contract**: No changes needed - use `type="number"` with string value. Browser will show number stepper, and validation will parse to number.

#### 2. SignUpForm component

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Add four new state variables (`city`, `gardenName`, `gardenWidth`, `gardenHeight`), validation logic for these fields, and four FormField components in the JSX. Add icons (MapPin for city, Home for garden name, Ruler for dimensions from lucide-react). Add hidden inputs so formData includes new fields when POSTed.

**Contract**: 

- State: `const [city, setCity] = useState("")`, `const [gardenName, setGardenName] = useState("")`, `const [gardenWidth, setGardenWidth] = useState("")`, `const [gardenHeight, setGardenHeight] = useState("")`
- Validation in `validate()` function:
  - City: non-empty, 2–100 chars, no special validation (WeatherAPI validates on server)
  - Garden name: optional (no validation required; can be empty)
  - Width: non-empty, parse to number, check 0.1 ≤ width ≤ 100
  - Height: non-empty, parse to number, check 0.1 ≤ height ≤ 100
- Errors: extend `errors` state type to include `city?: string; gardenName?: string; gardenWidth?: string; gardenHeight?: string`
- JSX: add four FormField components after confirmPassword field, before ServerError:

```tsx
<FormField
  id="city"
  label="City"
  value={city}
  onChange={(v) => { setCity(v); clearError("city"); }}
  placeholder="e.g., Warsaw"
  error={errors.city}
  icon={<MapPin className="size-4" />}
/>

<FormField
  id="gardenName"
  name="garden_name"
  label="Garden name (optional)"
  value={gardenName}
  onChange={(v) => { setGardenName(v); clearError("gardenName"); }}
  placeholder="e.g., My Garden, Balcony"
  error={errors.gardenName}
  hint={!errors.gardenName && <p className="text-muted-foreground mt-1 text-xs">Give your garden a friendly name</p>}
  icon={<Home className="size-4" />}
/>

<FormField
  id="gardenWidth"
  name="garden_width"
  label="Garden width (m)"
  type="number"
  value={gardenWidth}
  onChange={(v) => { setGardenWidth(v); clearError("gardenWidth"); }}
  placeholder="e.g., 5.5"
  error={errors.gardenWidth}
  hint={!errors.gardenWidth && <p className="text-muted-foreground mt-1 text-xs">Width of your garden in meters</p>}
  icon={<Ruler className="size-4" />}
/>

<FormField
  id="gardenHeight"
  name="garden_height"
  label="Garden height (m)"
  type="number"
  value={gardenHeight}
  onChange={(v) => { setGardenHeight(v); clearError("gardenHeight"); }}
  placeholder="e.g., 8.0"
  error={errors.gardenHeight}
  hint={!errors.gardenHeight && <p className="text-muted-foreground mt-1 text-xs">Height of your garden in meters</p>}
  icon={<Ruler className="size-4" />}
/>
```

- Validation logic (add to `validate()` function lines 22-45):

```typescript
// City validation
if (!city.trim()) {
  next.city = "City is required";
} else if (city.length < 2 || city.length > 100) {
  next.city = "City name must be between 2 and 100 characters";
}

// Garden name validation (optional - no validation needed)
// No validation for garden name - it's optional

// Garden width validation
if (!gardenWidth.trim()) {
  next.gardenWidth = "Garden width is required";
} else {
  const width = Number.parseFloat(gardenWidth);
  if (Number.isNaN(width)) {
    next.gardenWidth = "Enter a valid number";
  } else if (width < 0.1 || width > 100) {
    next.gardenWidth = "Width must be between 0.1 and 100 meters";
  }
}

// Garden height validation
if (!gardenHeight.trim()) {
  next.gardenHeight = "Garden height is required";
} else {
  const height = Number.parseFloat(gardenHeight);
  if (Number.isNaN(height)) {
    next.gardenHeight = "Enter a valid number";
  } else if (height < 0.1 || height > 100) {
    next.gardenHeight = "Height must be between 0.1 and 100 meters";
  }
}
```

- Import: Add `import { MapPin, Home, Ruler } from "lucide-react";` at top

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Component renders: `npm run dev` → navigate to `/auth/signup` → form loads without errors

#### Manual Verification:

- Form shows 8 fields: email, password, confirm password, city, garden name, width, height
- City field has MapPin icon and "e.g., Warsaw" placeholder
- Garden name field has Home icon, "optional" label, and helpful hint
- Dimension fields have Ruler icons and hints visible
- Type invalid city (empty) → submit → shows "City is required" error
- Type invalid width ("abc") → shows "Enter a valid number" error
- Type width 101 → shows "Width must be between 0.1 and 100 meters" error
- Garden name can be empty (no validation error)
- Type valid data → no client errors → form submits (API will reject for now)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Signup API Enhancement

### Overview

Update the signup API endpoint to validate new fields with zod, call WeatherAPI to validate city name, create a profile row after successful auth.signUp, and handle profile insert failures gracefully.

### Changes Required:

#### 1. Signup API endpoint

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Transform from a simple formData-reading pass-through to a robust handler with validation, profile creation, and error handling. Follow the pattern from photo upload API (`src/pages/api/photos/upload.ts`).

**Contract**: 

- Add `export const prerender = false;` at top (like photo upload line 8)
- Define zod schema:

```typescript
const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  city: z.string().min(2, "City name must be at least 2 characters").max(100, "City name too long"),
  garden_width: z.coerce.number().min(0.1, "Width must be at least 0.1m").max(100, "Width must be at most 100m"),
  garden_height: z.coerce.number().min(0.1, "Height must be at least 0.1m").max(100, "Height must be at most 100m"),
});
```

- Parse and validate formData with `safeParse`
- If validation fails: redirect back to `/auth/signup?error=...` (concatenate zod errors)
- If validation passes: call `supabase.auth.signUp({ email, password })`
- If auth fails: redirect back with error (existing behavior)
- If auth succeeds: validate city name via WeatherAPI
- If city invalid: redirect back with error "City not found or could not be validated"
- If city valid: insert profile row with `location_city`, `garden_name` (nullable), `garden_width`, `garden_height`
- If profile insert fails: redirect back with error "Failed to create profile. Please try again."
- If profile insert succeeds: redirect to `/auth/confirm-email` (existing behavior)

Full rewritten API handler:

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { WeatherService } from "@/lib/weather";
import { WEATHER_API_KEY } from "astro:env/server";

export const prerender = false;

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  city: z.string().min(2, "City name must be at least 2 characters").max(100, "City name too long"),
  garden_name: z.string().min(1, "Garden name is required").max(100, "Garden name too long"),
  garden_width: z.coerce.number().min(0.1, "Width must be at least 0.1m").max(100, "Width must be at most 100m"),
  garden_height: z.coerce.number().min(0.1, "Height must be at least 0.1m").max(100, "Height must be at most 100m"),
});

export const POST: APIRoute = async (context) => {
  // Parse form data
  const form = await context.request.formData();
  
  // Validate input
  const parseResult = signupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    city: form.get("city"),
    garden_name: form.get("garden_name") || "",
    garden_width: form.get("garden_width"),
    garden_height: form.get("garden_height"),
  });

  if (!parseResult.success) {
    const errorMessage = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join("; ");
    return context.redirect(`/auth/signup?error=${encodeURIComponent(errorMessage)}`);
  }

  const { email, password, city, garden_name, garden_width, garden_height } = parseResult.data;

  // Create Supabase client
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authError.message)}`);
  }

  if (!authData.user) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Signup succeeded but user data is missing")}`);
  }

  // Validate city name via WeatherAPI
  const weatherService = new WeatherService(WEATHER_API_KEY);
  const isCityValid = await weatherService.validateCityName(city);

  if (!isCityValid) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("City not found or could not be validated. Please check the city name.")}`);
  }

  // Create profile row
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    location_city: city,
    garden_name: garden_name || null,
    garden_width,
    garden_height,
  });

  if (profileError) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Failed to create profile. Please try again or contact support.")}`);
  }

  // Success - redirect to confirm email
  return context.redirect("/auth/confirm-email");
};
```

#### 2. Import WeatherService

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Import WeatherService class and WEATHER_API_KEY env var to validate city names.

**Contract**: Add `import { WeatherService } from "@/lib/weather";` and `import { WEATHER_API_KEY } from "astro:env/server";` at top.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Valid signup: fill form with valid data (email, password, "Warsaw", "My Balcony", 5.5, 8.0) → submit → redirects to `/auth/confirm-email`
- Check database: `SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;` → row exists
- Check profile: `SELECT * FROM profiles ORDER BY created_at DESC LIMIT 1;` → row exists with `location_city='Warsaw'`, `garden_name='My Balcony'`, `garden_width=5.5`, `garden_height=8.0`
- Invalid city: submit with city "XYZ123NotACity" → shows error "City not found or could not be validated"
- Invalid width: submit with width 101 → shows error "Width must be at most 100m"
- Missing field: submit with empty city → shows error "City name must be at least 2 characters"
- Duplicate email: submit with email that already exists → shows Supabase error "User already registered"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Testing & Verification

### Overview

Comprehensive manual testing of the full signup flow including error scenarios and edge cases.

### Changes Required:

No code changes - this phase is testing only.

### Success Criteria:

#### Automated Verification:

- All previous automated checks still pass: `npm run typecheck && npm run lint && npm run build`
- Integration tests pass: `npm run test:integration` (if any signup tests exist)

#### Manual Verification:

**Happy path:**
- Navigate to `/auth/signup`
- Fill valid data: `test+123@example.com`, `password123`, `London`, `My Garden`, `10.5`, `12.0`
- Submit → redirects to `/auth/confirm-email`
- Check DB: profile row exists with correct data including garden_name

**Client validation:**
- Empty email → "Email is required"
- Invalid email → "Enter a valid email address"
- Short password → "Password must be at least 6 characters"
- Mismatched passwords → "Passwords do not match"
- Empty city → "City is required"
- Short city → "City name must be at least 2 characters"
- Empty width → "Garden width is required"
- Non-numeric width → "Enter a valid number"
- Width 0.05 → "Width must be between 0.1 and 100 meters"
- Width 101 → "Width must be between 0.1 and 100 meters"
- Same validations for height

**Server validation:**
- Submit valid form but manipulate request to send width=101 → server catches it → error shown
- Invalid city "XYZABC123" → "City not found or could not be validated"

**Error recovery:**
- Submit with invalid city → error shown → fix city → submit again → succeeds
- Submit with existing email → error shown → change email → submit again → succeeds

**Edge cases:**
- City with special characters: "São Paulo" → succeeds (WeatherAPI handles it)
- City with spaces: "New York" → succeeds
- Minimum dimensions: 0.1m x 0.1m → succeeds
- Maximum dimensions: 100m x 100m → succeeds
- Decimal precision: 5.55m → succeeds, stored correctly

**Profile orphaning scenario (expected failure mode):**
- Manually break profile insert by temporarily modifying RLS policy or constraint
- Submit signup → auth succeeds but profile fails → error shown
- User sees error "Failed to create profile"
- Check DB: auth.users row exists, profiles row does NOT exist
- Log in with created account → redirected to dashboard (no profile check yet, this is expected)
- Future enhancement: add middleware check for missing profile and redirect to complete-profile page

**Implementation Note**: After completing this phase and all manual testing is successful, the feature is ready for deployment.

---

## Testing Strategy

### Unit Tests:

No unit tests required for MVP - manual testing covers the scope. Future enhancement: add tests for:
- WeatherService.validateCityName()
- Zod schema validation edge cases
- Profile insert error handling

### Integration Tests:

Future enhancement: add API integration tests for signup endpoint with test database:
- Valid signup creates auth user + profile
- Invalid city returns error
- Invalid dimensions return error
- Duplicate email returns error

### Manual Testing Steps:

Covered comprehensively in Phase 5 success criteria above. Key scenarios:
1. Happy path (valid signup)
2. All client validation errors
3. Server validation errors (invalid city, dimensions)
4. Error recovery (fix error and retry)
5. Edge cases (special characters, min/max values)
6. Profile orphaning scenario

## Performance Considerations

**WeatherAPI rate limits:**
- Free tier: 1,000,000 requests/month
- Signup city validation adds ~1 call per signup attempt
- For MVP with low traffic (<100 signups/day), rate limit is not a concern
- Monitor usage in WeatherAPI dashboard
- If approaching limit: add caching layer (store validated city names in Redis/DB for 24h)

**Form submission latency:**
- Added ~500ms for WeatherAPI city validation call during signup
- User sees loading state via SubmitButton pending state (existing component)
- If WeatherAPI is slow or down: validation fails after 5s timeout → user sees error → can retry
- Acceptable for MVP given infrequent operation (once per user)

## Migration Notes

**Existing users (if any):**
- Migration adds nullable `location_city` column → existing profiles have NULL
- No data backfill needed - existing profiles are pre-MVP test data
- If production users exist: add separate migration to require manual profile completion (future enhancement)

**Rolling back:**
- If signup breaks: revert changes to `src/pages/api/auth/signup.ts` and `src/components/auth/SignUpForm.tsx`
- Database migration is additive (new column) - safe to keep, will be NULL for reverted signups
- To fully rollback: run `supabase migration revert` to remove `location_city` column

## References

- PRD: `context/foundation/prd.md` (FR-001, FR-012)
- Roadmap: `context/foundation/roadmap.md` (S-01 slice)
- Schema migration: `supabase/migrations/20260604120000_core_data_schema.sql` (profiles table lines 5-13)
- Existing signup form: `src/components/auth/SignUpForm.tsx`
- Existing signup API: `src/pages/api/auth/signup.ts`
- FormField component: `src/components/auth/FormField.tsx`
- Photo upload API (validation pattern): `src/pages/api/photos/upload.ts`
- WeatherService: `src/lib/weather.ts`
- Types and error codes: `src/types.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Schema Extension

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase migration up` — 59e7da7
- [x] 1.2 TypeScript build passes: `npm run build` — 59e7da7
- [x] 1.3 Type checking passes: `npm run typecheck` — 59e7da7

#### Manual

- [x] 1.4 Query profiles table shows `location_city` and `garden_name` columns — 59e7da7
- [x] 1.5 `src/database.types.ts` contains `location_city` and `garden_name` in profiles type — 59e7da7

### Phase 2: WeatherAPI City Validation

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 2f189f0
- [x] 2.2 Linting passes: `npm run lint` — 2f189f0
- [x] 2.3 Build passes: `npm run build` — 2f189f0

#### Manual

- [x] 2.4 Test valid city returns `true` — 2f189f0
- [x] 2.5 Test invalid city returns `false` — 2f189f0
- [x] 2.6 Test network timeout returns `false` gracefully — 2f189f0

### Phase 3: Signup Form Extension

#### Automated

- [x] 3.1 Type checking passes: `npm run typecheck`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build passes: `npm run build`
- [x] 3.4 Component renders: form loads without errors at `/auth/signup`

#### Manual

- [x] 3.5 Form shows 8 fields with correct icons and placeholders — dfff3c2
- [x] 3.6 Empty city shows "City is required" error — dfff3c2
- [x] 3.7 Invalid width "abc" shows "Enter a valid number" error — dfff3c2
- [x] 3.8 Width 101 shows range error — dfff3c2
- [x] 3.9 Valid data passes client validation — dfff3c2

### Phase 4: Signup API Enhancement

#### Automated

- [x] 4.1 Type checking passes: `npm run typecheck` — 90d36a4
- [x] 4.2 Linting passes: `npm run lint` — 90d36a4
- [x] 4.3 Build passes: `npm run build` — 90d36a4

#### Manual

- [x] 4.4 Valid signup creates auth user + profile with correct data — dfff3c2
- [x] 4.5 Invalid city "XYZ123NotACity" shows error — dfff3c2
- [x] 4.6 Width 101 shows server validation error — dfff3c2
- [x] 4.7 Missing city shows zod error — dfff3c2
- [x] 4.8 Duplicate email shows Supabase error — dfff3c2

### Phase 5: Testing & Verification

#### Automated

- [x] 5.1 All checks pass: `npm run typecheck && npm run lint && npm run build` — 90d36a4
- [x] 5.2 Integration tests pass: `npm run test:integration` (no signup tests exist yet) — dfff3c2

#### Manual

- [x] 5.3 Happy path: valid signup → confirm-email → profile exists — cf92a80
- [x] 5.4 All client validation errors display correctly — cf92a80
- [x] 5.5 Server validation catches invalid city and dimensions — cf92a80
- [x] 5.6 Error recovery: fix error and retry succeeds — cf92a80
- [x] 5.7 Edge cases: special characters, min/max values work — cf92a80
- [x] 5.8 Profile orphaning scenario behaves as expected — cf92a80
