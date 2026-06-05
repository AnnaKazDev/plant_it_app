import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/storage";
import { ERROR_CODES } from "@/types";
import type { ApiError } from "@/types";

export const prerender = false;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PHOTOS_PER_ACTION = 5;

const uploadSchema = z.object({
  action_id: z.string(),
  file: z.instanceof(File, { message: "File is required" }),
});

export const POST: APIRoute = async (context) => {
  // Auth check (middleware already ran, but double-check)
  if (!context.locals.user) {
    return Response.json(
      {
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: "Authentication required",
        } satisfies ApiError,
      },
      { status: 401 },
    );
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid multipart form data",
        } satisfies ApiError,
      },
      { status: 400 },
    );
  }

  // Validate input
  const parseResult = uploadSchema.safeParse({
    action_id: formData.get("action_id"),
    file: formData.get("file"),
  });

  if (!parseResult.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: { errors: parseResult.error.errors },
        } satisfies ApiError,
      },
      { status: 400 },
    );
  }

  const { action_id, file } = parseResult.data;

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return Response.json(
      {
        error: {
          code: ERROR_CODES.INVALID_FILE_TYPE,
          message: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
          details: { received: file.type },
        } satisfies ApiError,
      },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      {
        error: {
          code: ERROR_CODES.FILE_TOO_LARGE,
          message: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          details: { size_bytes: file.size, max_size_bytes: MAX_FILE_SIZE },
        } satisfies ApiError,
      },
      { status: 413 },
    );
  }

  // Create Supabase client
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initialize database client",
        } satisfies ApiError,
      },
      { status: 500 },
    );
  }

  // Verify action exists and user owns it (via RLS)
  const { data: action } = await supabase.from("actions").select("id").eq("id", action_id).single();

  if (!action) {
    return Response.json(
      {
        error: {
          code: ERROR_CODES.ACTION_NOT_FOUND,
          message: "Action not found or access denied",
        } satisfies ApiError,
      },
      { status: 404 },
    );
  }

  // Check max photos limit
  const { count, error: countError } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })
    .eq("action_id", action_id);

  if (countError) {
    return Response.json(
      {
        error: {
          code: "DATABASE_ERROR",
          message: "Failed to count existing photos",
          details: { error: countError.message },
        } satisfies ApiError,
      },
      { status: 500 },
    );
  }

  if (count !== null && count >= MAX_PHOTOS_PER_ACTION) {
    return Response.json(
      {
        error: {
          code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
          message: `Maximum ${MAX_PHOTOS_PER_ACTION} photos per action`,
          details: { current_count: count },
        } satisfies ApiError,
      },
      { status: 400 },
    );
  }

  // Upload to storage
  let uploadResult;
  try {
    uploadResult = await uploadPhoto(supabase, file, context.locals.user.id, action_id);
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to upload file",
          details: { error: String(error) },
        } satisfies ApiError,
      },
      { status: 500 },
    );
  }

  // Insert photo record
  const { data: photo } = await supabase
    .from("photos")
    .insert({
      action_id,
      photo_url: uploadResult.photo_url,
      order_index: (count ?? 0) + 1,
    })
    .select("id, photo_url, order_index, created_at")
    .single();

  if (!photo) {
    return Response.json(
      {
        error: {
          code: "DATABASE_ERROR",
          message: "Failed to save photo record",
        } satisfies ApiError,
      },
      { status: 500 },
    );
  }

  // Success response
  return Response.json(
    {
      success: true,
      photo: {
        id: photo.id,
        photo_url: photo.photo_url,
        size_bytes: uploadResult.size_bytes,
        order_index: photo.order_index,
        created_at: photo.created_at,
      },
    },
    { status: 201 },
  );
};
