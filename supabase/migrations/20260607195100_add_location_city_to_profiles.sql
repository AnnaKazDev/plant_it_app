-- Add location_city and garden_name columns to profiles table
-- Migration created: 2026-06-07
-- Updated: 2026-06-08 (added garden_name for MVP single-garden naming)

ALTER TABLE public.profiles
ADD COLUMN location_city TEXT,
ADD COLUMN garden_name TEXT;
