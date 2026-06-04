# Core Database Schema Implementation Plan

## Overview

Create the foundational database schema for Plant It: plants, actions, action_types, photos, and user profiles with location/garden dimensions. Includes RLS policies, indexes, seed data, and TypeScript type definitions.

## Current State Analysis

**Database:**
- Supabase configured for auth-only usage (no app tables yet)
- No `supabase/migrations/` directory exists
- Migration convention documented: `YYYYMMDDHHmmss_short_description.sql` format
- RLS required on all new tables (AGENTS.md:11)

**Codebase:**
- Supabase client at `src/lib/supabase.ts` is untyped (no `Database` generic)
- No `src/types.ts` file yet (convention: shared types go here per CLAUDE.md:42)
- Auth pattern: `Astro.locals.user` from middleware, `user.id` will be FK for `user_id` columns

**External dependencies:**
- WeatherAPI.com for weather data (free tier: 1M calls/month)
- Expected fields: temp_max, temp_min, wind, precip, humidity, sunrise, sunset, moonrise, moonset, moon_phase, plus potentially more

## Desired End State

A complete database foundation that enables:
- User registration with location + garden dimensions (S-01)
- Adding plants with grid coordinates (S-02)
- Recording actions (predefined or custom) with weather data and photos (S-02)
- Querying user's own data only (RLS enforced)

**Verification:**
- Migration applies cleanly: `npx supabase db reset`
- Seed data present: 30 action_types with emoji icons
- RLS works: cross-user queries blocked via Supabase Studio
- Types compile: `npm run build` passes with new types

### Key Discoveries:

- Current Supabase usage is auth-only; this will be the first app data schema
- Project uses TypeScript strict mode with shared types at `src/types.ts` (doesn't exist yet)
- RLS convention: per-operation policies (not one-size-fits-all)
- Icon decision: Unicode emoji (zero dependencies, works everywhere)

## What We're NOT Doing

- Photo storage buckets or upload API (that's F-02: photo-storage-setup)
- Storage cleanup triggers (deferred to F-02 when Storage is configured)
- Weather API integration code (that's F-03: weather-api-integration)
- Supabase Database type generation via CLI (hand-written types only for now)
- Composite indexes for performance (FKs + user_id only; optimize later if needed)
- UI components or API routes (schema only)

## Implementation Approach

**Single migration file** with all tables, constraints, RLS policies, indexes, and seed data. TypeScript types defined in a separate phase to match the schema exactly.

**Key decisions:**
- **User profile:** New `public.profiles` table (1:1 with `auth.users`)
- **Coordinates:** Numeric `grid_x`, `grid_y` integers (not text like "A3")
- **Weather data:** JSONB storing full WeatherAPI.com response
- **Action types:** ~30 predefined actions with emoji icons, nullable FK allows custom actions
- **Photo deletion:** SQL CASCADE (Storage cleanup deferred to F-02)
- **RLS granularity:** Separate policies per operation (SELECT, INSERT, UPDATE, DELETE)
- **Date storage:** TIMESTAMPTZ (timezone-aware) for action dates
- **Indexes:** FKs (auto-created) + explicit indexes on `user_id` columns

## Phase 1: Database Schema Foundation

### Overview

Create all tables, RLS policies, indexes, and seed 30 action types with emoji icons.

### Changes Required:

#### 1. Create migrations directory

**File**: `supabase/migrations/` (directory)

**Intent**: Create the migrations folder that Supabase CLI expects (referenced in `supabase/config.toml:58` but doesn't exist yet).

**Contract**: Directory exists at project root, gitignored files per `supabase/.gitignore` won't be committed.

#### 2. Core schema migration

**File**: `supabase/migrations/20260604120000_core_data_schema.sql`

**Intent**: Define all tables (profiles, plants, action_types, actions, photos), RLS policies, indexes, and seed action_types with ~30 emoji-based entries. This is the atomic schema foundation.

**Contract**: Migration file with timestamp prefix matching convention (`YYYYMMDDHHmmss_`), structured in this order:

```sql
-- 1. profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_lat DECIMAL(9, 6),
  location_lng DECIMAL(9, 6),
  garden_width DECIMAL(5, 2) CHECK (garden_width > 0),
  garden_height DECIMAL(5, 2) CHECK (garden_height > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. plants table
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

-- 3. action_types table
CREATE TABLE public.action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(name) <= 100),
  icon_emoji TEXT NOT NULL CHECK (char_length(icon_emoji) <= 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  action_type_id UUID REFERENCES public.action_types(id) ON DELETE RESTRICT,
  custom_action_name TEXT CHECK (char_length(custom_action_name) <= 300),
  date TIMESTAMPTZ NOT NULL,
  weather_data JSONB,
  additional_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT action_name_check CHECK (
    (action_type_id IS NOT NULL AND custom_action_name IS NULL) OR
    (action_type_id IS NULL AND custom_action_name IS NOT NULL)
  )
);

-- 5. photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (action_id, order_index)
);

-- 6. Indexes
CREATE INDEX idx_plants_user_id ON public.plants(user_id);
CREATE INDEX idx_actions_plant_id ON public.actions(plant_id);
CREATE INDEX idx_actions_user_id ON public.actions(plant_id);  -- composite via plant_id FK
CREATE INDEX idx_photos_action_id ON public.photos(action_id);

-- 7. RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_delete ON public.profiles FOR DELETE USING (auth.uid() = id);

-- plants policies
CREATE POLICY plants_select ON public.plants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY plants_insert ON public.plants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY plants_update ON public.plants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY plants_delete ON public.plants FOR DELETE USING (auth.uid() = user_id);

-- action_types policies (read-only for all authenticated users)
CREATE POLICY action_types_select ON public.action_types FOR SELECT TO authenticated USING (true);

-- actions policies (via plant_id → plants.user_id)
CREATE POLICY actions_select ON public.actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_insert ON public.actions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_update ON public.actions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_delete ON public.actions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);

-- photos policies (via action_id → actions.plant_id → plants.user_id)
CREATE POLICY photos_select ON public.photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_insert ON public.photos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_update ON public.photos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_delete ON public.photos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);

-- 8. Seed action_types (30 common gardening actions with emoji icons)
INSERT INTO public.action_types (name, icon_emoji) VALUES
  ('watering', '💧'),
  ('fertilizing', '🌱'),
  ('pruning', '✂️'),
  ('planted_from_seed', '🌰'),
  ('transplanting', '🪴'),
  ('repotting', '🏺'),
  ('pest_control', '🐛'),
  ('disease_treatment', '💊'),
  ('weeding', '🌿'),
  ('mulching', '🍂'),
  ('staking', '🪵'),
  ('harvesting', '🌽'),
  ('deadheading', '🥀'),
  ('pinching', '👌'),
  ('thinning', '🌾'),
  ('dividing', '✂️'),
  ('propagating', '🌱'),
  ('composting', '♻️'),
  ('soil_testing', '🧪'),
  ('sun_exposure_change', '☀️'),
  ('shade_added', '⛱️'),
  ('frost_protection', '❄️'),
  ('heat_protection', '🔥'),
  ('wind_protection', '💨'),
  ('support_structure', '🏗️'),
  ('seed_collection', '🌾'),
  ('cleaning_leaves', '🧹'),
  ('top_dressing', '🌿'),
  ('observation_only', '👀'),
  ('general_care', '🛠️')
ON CONFLICT (name) DO NOTHING;
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `cd /Users/akazmierczak/Documents/10xdevs3/plant_it_app && npx supabase db reset`
- No SQL errors in output
- Seed data verified: `npx supabase db diff` shows no pending changes after reset

#### Manual Verification:

- Open Supabase Studio (`npx supabase studio` at http://127.0.0.1:54323)
- Verify all 5 tables exist under `public` schema
- Verify 30 rows in `action_types` table with emoji icons
- Test RLS: insert test plant as user A, try to SELECT as user B (should return empty)
- Verify indexes exist in table info panels

---

## Phase 2: TypeScript Types

### Overview

Create TypeScript type definitions matching the database schema for type-safe queries and components.

### Changes Required:

#### 1. Create shared types file

**File**: `src/types.ts`

**Intent**: Define TypeScript interfaces for all database entities (Profile, Plant, ActionType, Action, Photo) and document the expected weather_data structure from WeatherAPI.com.

**Contract**: Export interfaces matching the schema columns, using TypeScript conventions (camelCase for properties that match snake_case DB columns).

```typescript
// Database row types
export interface Profile {
  id: string; // UUID
  locationLat: number | null;
  locationLng: number | null;
  gardenWidth: number | null;
  gardenHeight: number | null;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface Plant {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  gridX: number;
  gridY: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionType {
  id: string;
  name: string;
  iconEmoji: string;
  createdAt: string;
}

export interface Action {
  id: string;
  plantId: string;
  actionTypeId: string | null;
  customActionName: string | null;
  date: string; // ISO timestamp
  weatherData: WeatherData | null;
  additionalData: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  actionId: string;
  photoUrl: string;
  orderIndex: number;
  createdAt: string;
}

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
  // Additional fields as needed; store full API response as JSONB
  [key: string]: unknown;
}

// UI/API helper types
export interface PlantWithLastAction extends Plant {
  lastAction?: Action;
  lastActionType?: ActionType;
}

export interface ActionWithType extends Action {
  actionType?: ActionType;
  plant?: Plant;
}

export interface ActionWithPhotos extends Action {
  photos: Photo[];
}
```

### Success Criteria:

#### Automated Verification:

- Type-checking passes: `npm run build` (or `npx tsc --noEmit`)
- Linting passes: `npm run lint`
- No unused imports or exports

#### Manual Verification:

- Open `src/types.ts` in IDE, verify IntelliSense suggestions work
- Check that all interfaces export correctly (no red squiggles)
- Confirm weather_data structure matches WeatherAPI.com docs

---

## Testing Strategy

### Unit Tests:

Not applicable (schema-only change, no application logic).

### Integration Tests:

Manual verification via Supabase Studio:
1. Insert a profile row via SQL editor, verify user_id FK constraint works
2. Insert a plant with invalid grid_x (negative number), expect CHECK constraint error
3. Insert an action with both action_type_id and custom_action_name, expect constraint violation
4. Insert 6 photos for one action, verify order_index uniqueness
5. Try to SELECT plants table as unauthenticated user, expect empty result (RLS blocks)

### Manual Testing Steps:

1. **Verify migration applied:**
   ```bash
   npx supabase db reset
   npx supabase db diff
   ```
   Expected: "No schema changes detected"

2. **Verify seed data:**
   Open Studio → Tables → action_types → expect 30 rows with emoji icons

3. **Verify RLS:**
   - Studio → SQL Editor:
     ```sql
     -- As authenticated user A (replace with real UUID after sign-up)
     SET request.jwt.claim.sub = 'user-a-uuid';
     INSERT INTO plants (user_id, name, grid_x, grid_y) VALUES ('user-a-uuid', 'Tomato', 0, 0);
     
     -- As authenticated user B
     SET request.jwt.claim.sub = 'user-b-uuid';
     SELECT * FROM plants; -- Should return empty (RLS blocks user B from seeing user A's plants)
     ```

4. **Verify types compile:**
   ```bash
   npm run build
   ```
   Expected: No TypeScript errors, build succeeds

5. **Verify constraint checks:**
   ```sql
   -- Try invalid data
   INSERT INTO plants (user_id, name, grid_x, grid_y) VALUES (auth.uid(), '', -1, 0);
   -- Expected error: CHECK constraint "plants_grid_x_check" violated
   ```

## Performance Considerations

- **Indexes on user_id:** All user-scoped queries filter by `auth.uid() = user_id` or join through `plants.user_id`, so these indexes are critical
- **FK indexes:** PostgreSQL auto-creates indexes on PRIMARY KEY but not on FOREIGN KEY columns; explicitly index `plant_id`, `action_id`, `action_type_id`
- **RLS policy cost:** JOIN-based policies on `photos` (2-level traversal) will be slower than direct policies; acceptable for MVP scale (10-100 plants per user)
- **JSONB weather_data:** No GIN index needed yet (no full-text search); defer until query patterns emerge

## Migration Notes

**First migration:**
- This is the project's first app-data migration (auth.users already exists via Supabase)
- No rollback migration needed (can drop entire schema and re-run if needed during dev)
- Once deployed to production Supabase project, treat as immutable (new migrations for schema changes)

**Local development:**
- `npx supabase start` (requires Docker) spins up local Postgres + Studio
- `npx supabase db reset` applies all migrations from scratch (destructive)
- `npx supabase db diff --schema public` compares local vs remote schema

**Production deployment:**
- Link to remote project: `npx supabase link --project-ref YOUR_PROJECT_REF`
- Push migrations: `npx supabase db push` (applies pending migrations only)
- Verify RLS works: test cross-user queries via Studio on remote project

## References

- Related change: `context/changes/core-data-schema/change.md`
- Roadmap entry: F-01 in `context/foundation/roadmap.md:88-101`
- RLS convention: `AGENTS.md:11`
- Types convention: `CLAUDE.md:42`
- WeatherAPI.com: https://www.weatherapi.com/api-explorer.aspx

## Addendum: Post-Implementation Refinements

### A1: CLI-Generated Types (2026-06-04, commit 03f6f3b)

**Context:** During Phase 2 implementation, after completing the hand-written type definitions per plan, a refinement was made to use Supabase CLI-generated types instead.

**Change:** Replaced the hand-written camelCase interfaces (as specified in the plan's Phase 2 contract) with:
- `src/database.types.ts` — generated via `npx supabase gen types` (346 lines, snake_case property names matching database exactly)
- `src/types.ts` — simplified to re-export generated types plus custom helper types (WeatherData, PlantWithLastAction, etc.)
- `src/lib/supabase.ts` — updated to use `Database` generic for typed client (`createServerClient<Database>(...)`)

**Note:** While the plan's Current State Analysis noted the client was "untyped (no `Database` generic)," updating the client was not explicitly listed as a Changes Required step. This update was a natural consequence of creating the Database type and is required for the types to be useful in practice.

**Rationale:** This is a Supabase best practice that provides:
1. **Auto-sync:** Types stay in sync with schema automatically; run `gen types` after migrations
2. **Zero mapping errors:** No manual snake_case ↔ camelCase translation needed
3. **Stronger type safety:** Includes Insert/Update types, exhaustive unions, and accurate nullability
4. **Reduced maintenance:** No need to manually update types.ts when schema changes

**Tradeoff:** Diverges from the original plan's camelCase convention. Snake_case property names in TypeScript may be less idiomatic for some teams, but they match the database exactly, reducing cognitive load when writing queries.

**Decision:** Accepted as an architectural improvement. Future schema changes should continue using `npx supabase gen types` to regenerate `database.types.ts` rather than hand-editing types.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Schema Foundation

#### Automated

- [x] 1.1 Migration applies cleanly — 1a084ec
- [x] 1.2 No SQL errors in output — 1a084ec
- [x] 1.3 Seed data verified via db diff — 1a084ec

#### Manual

- [x] 1.4 All 5 tables exist in Supabase Studio — 1a084ec
- [x] 1.5 30 action_types rows with emoji icons present — 1a084ec
- [x] 1.6 RLS test: cross-user query blocked — 1a084ec
- [x] 1.7 Indexes verified in table info panels — 1a084ec

### Phase 2: TypeScript Types

#### Automated

- [x] 2.1 Type-checking passes (npm run build) — 081f117
- [x] 2.2 Linting passes (npm run lint) — 081f117
- [x] 2.3 No unused imports/exports — 081f117

#### Manual

- [x] 2.4 IntelliSense works for new types in IDE — 081f117
- [x] 2.5 All interfaces export correctly — 081f117
- [x] 2.6 Weather data structure matches API docs — 081f117
