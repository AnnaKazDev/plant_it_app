import type { SupabaseClient } from "@supabase/supabase-js";

export interface UploadPhotoResult {
  photo_url: string;
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

/**
 * Upload a photo to the plant-photos storage bucket
 *
 * @param supabase - Authenticated Supabase client
 * @param file - File to upload
 * @param userId - User ID for folder structure
 * @param actionId - Action ID for folder structure
 * @returns Photo URL and file size
 * @throws StorageError on upload failure
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

  const { error: uploadError } = await supabase.storage.from("plant-photos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    throw new StorageError(`Failed to upload photo: ${uploadError.message}`, "UPLOAD_FAILED", {
      path,
      error: uploadError,
    });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("plant-photos").getPublicUrl(path);

  return {
    photo_url: publicUrl,
    size_bytes: file.size,
  };
}
