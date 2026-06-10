# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Index Planning: Favor Useful Indexes Over Duplicates

**Context:** supabase/migrations/20260604120000_core_data_schema.sql:65 - planning indexes for the actions table

**Problem:** Plan specified CREATE INDEX idx_actions_user_id ON public.actions(plant_id); with a confusing comment "composite via plant_id FK". This would have created a second index on plant_id (after idx_actions_plant_id on line 64), which is redundant. The actual implementation created an index on action_type_id instead, which supports useful queries like "show me all watering actions".

**Rule:** When planning database indexes, verify that each index serves a distinct query pattern. Avoid duplicate indexes on the same column. Consider which queries the application will actually run rather than mechanically indexing every foreign key.

**Applies to:** Database migration planning, schema design, index strategy

## After Regenerating Supabase Types, Run lint:fix

**Context:** `src/database.types.ts` — regenerated after every migration via `npx supabase gen types typescript --local > src/database.types.ts`

**Problem:** Supabase CLI output does not match project ESLint/Prettier rules: missing semicolons, `export type Database = {` instead of `interface`, `{ [_ in never]: never }` empty-object patterns, and inconsistent formatting. Committing raw generated output fails `npm run lint` in CI. This has been fixed manually multiple times (core-data-schema, extended-registration).

**Rule:** After every `supabase gen types` regeneration, always run `npm run lint:fix -- src/database.types.ts` before committing. Do not hand-edit types beyond what lint:fix applies. Keep the existing ESLint override in `eslint.config.js` (`generatedTypesConfig` disables `no-redundant-type-constituents` for this file) — it prevents false positives on Supabase's empty-schema patterns, but does not replace the format pass.

**Applies to:** implement, plan (schema migration phases), impl-review
