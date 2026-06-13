import type { APIRoute } from "astro";
import { z } from "zod";
import { fetchPlantListForUser } from "@/lib/plant-page";
import { DEFAULT_PLANT_ICON_ID, PLANT_ICON_IDS } from "@/lib/plant-icons";
import { createClient } from "@/lib/supabase";
import { isWithinGardenBounds } from "@/lib/grid";
import { formatPlantDisplayName } from "@/lib/plants";
import { validatePhotoFile } from "@/lib/photo-validation";
import { StorageError, uploadPlantPhoto } from "@/lib/storage";
import { ERROR_CODES } from "@/types";
import type { ApiError } from "@/types";

export const prerender = false;

const plantBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  grid_x: z.coerce.number().int().min(0),
  grid_y: z.coerce.number().int().min(0),
  icon_name: z.enum(PLANT_ICON_IDS).optional().default(DEFAULT_PLANT_ICON_ID),
});

function jsonError(error: ApiError, status: number): Response {
  return Response.json({ error }, { status });
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const plants = await fetchPlantListForUser(supabase, context.locals.user.id);

  return Response.json({ success: true, plants });
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const contentType = context.request.headers.get("content-type") ?? "";
  let name: string;
  let gridX: number;
  let gridY: number;
  let iconName: string;
  let photoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await context.request.formData();
    } catch {
      return jsonError({ code: "INVALID_REQUEST", message: "Invalid multipart form data" }, 400);
    }

    const parseResult = plantBodySchema.safeParse({
      name: formData.get("name"),
      grid_x: formData.get("grid_x"),
      grid_y: formData.get("grid_y"),
      icon_name: formData.get("icon_name") ?? undefined,
    });

    if (!parseResult.success) {
      return jsonError(
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Invalid input",
          details: { errors: parseResult.error.issues },
        },
        400,
      );
    }

    ({ name, grid_x: gridX, grid_y: gridY, icon_name: iconName } = parseResult.data);
    const fileField = formData.get("file");
    if (fileField instanceof File && fileField.size > 0) {
      photoFile = fileField;
    }
  } else {
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return jsonError({ code: "INVALID_REQUEST", message: "Invalid JSON body" }, 400);
    }

    const parseResult = plantBodySchema.safeParse(body);
    if (!parseResult.success) {
      return jsonError(
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Invalid input",
          details: { errors: parseResult.error.issues },
        },
        400,
      );
    }

    ({ name, grid_x: gridX, grid_y: gridY, icon_name: iconName } = parseResult.data);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("garden_width, garden_height")
    .eq("id", context.locals.user.id)
    .single();

  if (!profile?.garden_width || !profile.garden_height) {
    return jsonError(
      { code: ERROR_CODES.PROFILE_NOT_FOUND, message: "User profile or garden dimensions not found" },
      400,
    );
  }

  if (!isWithinGardenBounds(gridX, gridY, profile.garden_width, profile.garden_height)) {
    return jsonError(
      {
        code: ERROR_CODES.INVALID_GRID_POSITION,
        message: "Grid position is outside garden bounds",
        details: { grid_x: gridX, grid_y: gridY },
      },
      400,
    );
  }

  if (photoFile) {
    const fileValidation = validatePhotoFile(photoFile);
    if (!fileValidation.valid) {
      return jsonError(
        {
          code: fileValidation.code,
          message: fileValidation.message,
          details: { received: photoFile.type, size_bytes: photoFile.size },
        },
        fileValidation.code === "FILE_TOO_LARGE" ? 413 : 400,
      );
    }
  }

  const { data: plant, error: insertError } = await supabase
    .from("plants")
    .insert({
      user_id: context.locals.user.id,
      name,
      grid_x: gridX,
      grid_y: gridY,
      icon_name: iconName,
    })
    .select("id, name, grid_x, grid_y, icon_name, photo_url")
    .single();

  if (insertError) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to create plant",
        details: { error: insertError.message },
      },
      500,
    );
  }

  let photoUrl = plant.photo_url;

  if (photoFile) {
    try {
      const uploadResult = await uploadPlantPhoto(supabase, photoFile, context.locals.user.id, plant.id);
      const { data: updatedPlant, error: updateError } = await supabase
        .from("plants")
        .update({ photo_url: uploadResult.photo_url })
        .eq("id", plant.id)
        .select("photo_url")
        .single();

      if (updateError) {
        await supabase.storage.from("plant-photos").remove([uploadResult.storage_path]);
        await supabase.from("plants").delete().eq("id", plant.id);
        return jsonError(
          {
            code: "DATABASE_ERROR",
            message: "Failed to save plant photo URL",
            details: { error: updateError.message },
          },
          500,
        );
      }

      photoUrl = updatedPlant.photo_url;
    } catch (error) {
      await supabase.from("plants").delete().eq("id", plant.id);
      return jsonError(
        {
          code: "UPLOAD_FAILED",
          message: error instanceof StorageError ? error.message : "Failed to upload plant photo",
        },
        500,
      );
    }
  }

  return Response.json(
    {
      success: true,
      plant: {
        id: plant.id,
        name: plant.name,
        grid_x: plant.grid_x,
        grid_y: plant.grid_y,
        icon_name: plant.icon_name,
        photo_url: photoUrl,
        display_name: formatPlantDisplayName(plant.name, plant.grid_x, plant.grid_y),
      },
    },
    { status: 201 },
  );
};
