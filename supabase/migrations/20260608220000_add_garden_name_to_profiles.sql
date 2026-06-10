-- garden_name was added alongside location_city in 20260607195100_add_location_city_to_profiles.sql.
-- This migration is retained for history; IF NOT EXISTS keeps fresh installs idempotent.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS garden_name TEXT;
