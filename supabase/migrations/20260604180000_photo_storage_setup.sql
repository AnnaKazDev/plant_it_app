-- Photo Storage Setup
-- Creates storage bucket for plant photos with RLS policies enforcing user ownership

-- Create storage bucket for plant photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plant-photos',
  'plant-photos',
  false,
  10485760, -- 10 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);

-- RLS policies for storage.objects
-- Path structure: {user_id}/{action_id}/{uuid}.{ext}
-- Policy checks first folder in path matches authenticated user's ID
-- Note: RLS is already enabled on storage.objects by default

-- Policy: Users can view their own photos
CREATE POLICY "plant_photos_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can upload photos to their own folder
CREATE POLICY "plant_photos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own photos
CREATE POLICY "plant_photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own photos
CREATE POLICY "plant_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
