# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Index Planning: Favor Useful Indexes Over Duplicates

**Context:** supabase/migrations/20260604120000_core_data_schema.sql:65 - planning indexes for the actions table

**Problem:** Plan specified CREATE INDEX idx_actions_user_id ON public.actions(plant_id); with a confusing comment "composite via plant_id FK". This would have created a second index on plant_id (after idx_actions_plant_id on line 64), which is redundant. The actual implementation created an index on action_type_id instead, which supports useful queries like "show me all watering actions".

**Rule:** When planning database indexes, verify that each index serves a distinct query pattern. Avoid duplicate indexes on the same column. Consider which queries the application will actually run rather than mechanically indexing every foreign key.

**Applies to:** Database migration planning, schema design, index strategy
