import type { SupabaseClient } from "@supabase/supabase-js";

const PLANT_PHOTOS_BUCKET = "plant-photos";
const BUCKET_SEGMENT = "plant-photos/";
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600;

export function extractStoragePathFromPublicUrl(publicUrl: string): string | null {
  const bucketIndex = publicUrl.indexOf(BUCKET_SEGMENT);
  if (bucketIndex === -1) {
    return null;
  }
  return publicUrl.slice(bucketIndex + BUCKET_SEGMENT.length);
}

export interface UploadPhotoResult {
  photo_url: string;
  storage_path: string;
  size_bytes: number;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

function buildPublicUrl(supabase: SupabaseClient, path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(PLANT_PHOTOS_BUCKET).getPublicUrl(path);
  return publicUrl;
}

async function uploadToStorage(supabase: SupabaseClient, file: File, path: string): Promise<UploadPhotoResult> {
  const { error: uploadError } = await supabase.storage.from(PLANT_PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    throw new StorageError(`Failed to upload photo: ${uploadError.message}`, "UPLOAD_FAILED", {
      path,
      error: uploadError,
    });
  }

  return {
    photo_url: buildPublicUrl(supabase, path),
    storage_path: path,
    size_bytes: file.size,
  };
}

/**
 * Upload a photo to the plant-photos storage bucket for an action
 */
export async function uploadPhoto(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  actionId: string,
): Promise<UploadPhotoResult> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const uuid = crypto.randomUUID();
  const filename = `${uuid}.${ext}`;
  const path = `${userId}/${actionId}/${filename}`;
  return uploadToStorage(supabase, file, path);
}

/**
 * Upload a plant avatar photo
 */
export async function uploadPlantPhoto(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  plantId: string,
): Promise<UploadPhotoResult> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const uuid = crypto.randomUUID();
  const filename = `${uuid}.${ext}`;
  const path = `${userId}/plants/${plantId}/${filename}`;
  return uploadToStorage(supabase, file, path);
}

/**
 * Create a time-limited signed URL for a private bucket object
 */
export async function getSignedPhotoUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PLANT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
