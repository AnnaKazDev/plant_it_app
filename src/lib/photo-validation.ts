export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validatePhotoFile(file: File): { valid: true } | { valid: false; code: string; message: string } {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
    return {
      valid: false,
      code: "INVALID_FILE_TYPE",
      message: `Invalid file type. Allowed: ${ALLOWED_PHOTO_MIME_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_PHOTO_FILE_SIZE) {
    return {
      valid: false,
      code: "FILE_TOO_LARGE",
      message: `File too large. Maximum size: ${MAX_PHOTO_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}
