-- Add icon_name column to plants for map/picker lucide icon selection
ALTER TABLE public.plants ADD COLUMN icon_name TEXT NOT NULL DEFAULT 'sprout';
