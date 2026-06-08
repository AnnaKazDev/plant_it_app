-- Add garden_name column to profiles table
-- Migration created: 2026-06-08
-- Adds garden_name field for MVP single-garden naming (required field)

ALTER TABLE public.profiles
ADD COLUMN garden_name TEXT;
