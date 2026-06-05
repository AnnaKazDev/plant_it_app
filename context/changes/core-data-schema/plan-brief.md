# Core Database Schema — Plan Brief

> Full plan: `context/changes/core-data-schema/plan.md`

## What & Why

Create the foundational database schema for Plant It: plants, actions (with predefined/custom split), action_types with emoji icons, photos, and user profiles extended with location + garden dimensions. This unlocks user registration (S-01), adding plants with actions (S-02), and all subsequent features. Without this schema, the app cannot store or query any user data beyond auth.

## Starting Point

Supabase is configured for auth-only today (`auth.users` table only). No app-data tables, no migrations directory, no `src/types.ts` file. The project documents conventions (migration naming, RLS on all tables, types at `src/types.ts`) but hasn't applied them yet. This is the first application schema.

## Desired End State

A complete database foundation:

- 5 tables (profiles, plants, action_types, actions, photos) with constraints and indexes
- 30 seeded action types with emoji icons (watering 💧, fertilizing 🌱, pruning ✂️, etc.)
- RLS policies (per-operation) enforce user data isolation
- TypeScript types at `src/types.ts` match the schema
- Local migration applies cleanly via `npx supabase db reset`

## Key Decisions Made

| Decision                | Choice                                                  | Why (1 sentence)                                                                                                  |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| User profile storage    | New `public.profiles` table (1:1 with auth.users)       | Keeps auth.users clean; allows custom columns (location, garden size) without touching Supabase Auth's schema.    |
| Plant grid coordinates  | Numeric `grid_x`, `grid_y` (integers)                   | Simpler validation, easier arithmetic (e.g., check bounds, calculate distance), avoids text parsing of "A3".      |
| Weather data structure  | JSONB storing full WeatherAPI.com response              | Flexible — UI can extract whatever fields it needs (temp, wind, sun/moon times) without schema changes later.     |
| Action types approach   | ~30 predefined with nullable FK + custom names          | Allows predefined actions (with emoji icons) to show nicely in UI, plus free-form custom actions for flexibility. |
| Photo deletion behavior | SQL CASCADE (Storage cleanup deferred)                  | Photos table auto-deletes when action deleted; Storage cleanup trigger deferred to F-02 (photo-storage-setup).    |
| RLS granularity         | Per-operation policies (SELECT, INSERT, UPDATE, DELETE) | Granular control per Supabase best practices; can restrict operations independently (e.g., read-only tables).     |
| Date storage            | TIMESTAMPTZ (timezone-aware)                            | Stores action dates with timezone; pairs with user's location for correct weather lookups and display.            |
| Indexes                 | FKs + `user_id` on user-scoped tables                   | Critical for RLS performance (`auth.uid() = user_id` filters); defer composite indexes until performance tested.  |
| Icon system             | Unicode emoji (no dependencies)                         | Zero npm packages, works in DB/API/UI/Studio, instantly recognizable, no asset pipeline needed.                   |

## Scope

**In scope:**

- All 5 tables with constraints, FKs, and CHECK rules
- RLS policies (4 per table: SELECT, INSERT, UPDATE, DELETE)
- Indexes on FKs and `user_id`
- Seed 30 action_types with emoji icons
- TypeScript interfaces in `src/types.ts`

**Out of scope:**

- Photo storage buckets or upload API (F-02: photo-storage-setup)
- Storage cleanup trigger for deleted photos (deferred to F-02)
- Weather API integration code (F-03: weather-api-integration)
- Supabase CLI type generation (hand-written types only for now)
- UI components or API endpoints (schema foundation only)

## Architecture / Approach

**Single migration** (`20260604120000_core_data_schema.sql`) with all tables, RLS, indexes, and seed data. **TypeScript types** defined separately in Phase 2 to match the landed schema.

**Data model:**

```
auth.users (Supabase built-in)
  ↓ 1:1
public.profiles (location, garden dimensions)

auth.users
  ↓ 1:N
public.plants (name, photo_url, grid_x, grid_y)
  ↓ 1:N
public.actions (date, weather_data JSONB, custom_action_name OR action_type_id FK)
  ↓ 1:N
public.photos (photo_url, order_index)

public.action_types (name, icon_emoji) ← 30 seeded rows
  ↓ 0:N (nullable FK)
public.actions
```

**RLS strategy:**

- `profiles`, `plants`: direct `auth.uid() = user_id` check
- `action_types`: read-only for all authenticated users
- `actions`: JOIN through `plants.user_id`
- `photos`: 2-level JOIN through `actions.plant_id → plants.user_id`

## Phases at a Glance

| Phase                         | What it delivers                    | Key risk                                               |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------ |
| 1. Database Schema Foundation | All tables, RLS, indexes, seed data | RLS policies with JOINs may be slow; test at scale     |
| 2. TypeScript Types           | `src/types.ts` with interfaces      | Types might drift from schema if not regenerated later |

**Prerequisites:** Docker running (for `npx supabase start`)  
**Estimated effort:** ~1 session (2-3 hours): write migration, test RLS, write types, verify

## Open Risks & Assumptions

- **WeatherAPI.com structure may change:** Storing full JSONB response is safe, but UI will break if API renames fields (e.g., `temp_max` → `maxTemp`). Mitigate: version API calls or add schema validation in F-03.
- **RLS JOIN performance:** `photos` policies traverse 2 FKs (action → plant → user). Acceptable for MVP (10-100 plants per user), but may need optimization (indexed FK columns + EXPLAIN ANALYZE) if users have 1000+ photos.
- **No rollback migration:** First schema — if something's wrong, drop and re-run. Once in production, treat as immutable (new migrations for changes).
- **Emoji rendering:** Unicode emoji works everywhere, but some systems (older terminals, SQL editors) may not render them correctly. Not a blocker — data is valid, just visually garbled in edge-case tools.

## Success Criteria (Summary)

- Migration applies cleanly: `npx supabase db reset` succeeds with no SQL errors
- Seed data present: 30 action_types with emoji icons visible in Studio
- RLS enforced: cross-user queries blocked (user A cannot SELECT user B's plants)
- Types compile: `npm run build` passes with new `src/types.ts` in place
