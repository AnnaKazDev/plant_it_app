import type { APIRoute } from "astro";
import { compareActionsByDateDesc } from "@/lib/action-dates";
import { createClient } from "@/lib/supabase";
import { formatPlantDisplayName } from "@/lib/plants";
import { extractStoragePathFromPublicUrl, getSignedPhotoUrl } from "@/lib/storage";
import { ERROR_CODES } from "@/types";
import type { ApiError } from "@/types";

export const prerender = false;

function jsonError(error: ApiError, status: number): Response {
  return Response.json({ error }, { status });
}

async function signPhotoUrl(supabase: NonNullable<ReturnType<typeof createClient>>, photoUrl: string): Promise<string> {
  const storagePath = extractStoragePathFromPublicUrl(photoUrl);
  if (!storagePath) {
    return photoUrl;
  }

  const signedUrl = await getSignedPhotoUrl(supabase, storagePath);
  return signedUrl ?? photoUrl;
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const plantId = context.params.id;
  if (!plantId) {
    return jsonError({ code: ERROR_CODES.VALIDATION_ERROR, message: "Plant ID is required" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const { data: plant, error } = await supabase
    .from("plants")
    .select(
      `
      id,
      name,
      photo_url,
      grid_x,
      grid_y,
      created_at,
      updated_at,
      actions (
        id,
        action_type_id,
        custom_action_name,
        date,
        weather_data,
        additional_data,
        created_at,
        photos (
          id,
          photo_url,
          order_index,
          created_at
        ),
        action_types (
          id,
          name,
          icon_emoji
        )
      )
    `,
    )
    .eq("id", plantId)
    .single();

  if (error) {
    return jsonError({ code: ERROR_CODES.PLANT_NOT_FOUND, message: "Plant not found or access denied" }, 404);
  }

  const signedPlantPhotoUrl = plant.photo_url ? await signPhotoUrl(supabase, plant.photo_url) : null;

  const actions = await Promise.all(
    plant.actions.sort(compareActionsByDateDesc).map(async (action) => {
      const photos = await Promise.all(
        action.photos
          .sort((a, b) => a.order_index - b.order_index)
          .map(async (photo) => ({
            ...photo,
            signed_photo_url: await signPhotoUrl(supabase, photo.photo_url),
          })),
      );

      return {
        id: action.id,
        action_type_id: action.action_type_id,
        custom_action_name: action.custom_action_name,
        date: action.date,
        weather_data: action.weather_data,
        additional_data: action.additional_data,
        created_at: action.created_at,
        action_type: action.action_types,
        photos,
      };
    }),
  );

  return Response.json({
    success: true,
    plant: {
      id: plant.id,
      name: plant.name,
      grid_x: plant.grid_x,
      grid_y: plant.grid_y,
      photo_url: plant.photo_url,
      signed_photo_url: signedPlantPhotoUrl,
      display_name: formatPlantDisplayName(plant.name, plant.grid_x, plant.grid_y),
      created_at: plant.created_at,
      updated_at: plant.updated_at,
      actions,
    },
  });
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const plantId = context.params.id;
  if (!plantId) {
    return jsonError({ code: ERROR_CODES.VALIDATION_ERROR, message: "Plant ID is required" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const { error: fetchError } = await supabase.from("plants").select("id").eq("id", plantId).single();

  if (fetchError) {
    return jsonError({ code: ERROR_CODES.PLANT_NOT_FOUND, message: "Plant not found or access denied" }, 404);
  }

  const { error: deleteError } = await supabase.from("plants").delete().eq("id", plantId);

  if (deleteError) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to delete plant",
        details: { error: deleteError.message },
      },
      500,
    );
  }

  return Response.json({ success: true });
};
