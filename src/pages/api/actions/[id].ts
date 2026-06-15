import type { APIRoute } from "astro";
import { z } from "zod";
import { WEATHER_API_KEY } from "astro:env/server";
import { createClient } from "@/lib/supabase";
import { WeatherService } from "@/lib/weather";
import type { Json } from "@/database.types";
import { ERROR_CODES } from "@/types";
import type { ApiError, WeatherData } from "@/types";

export const prerender = false;

const patchActionSchema = z.object({
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" })
    .optional(),
  additional_data: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
});

function jsonError(error: ApiError, status: number): Response {
  return Response.json({ error }, { status });
}

function toWeatherDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

async function actionExistsForUser(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  actionId: string,
): Promise<boolean> {
  const { data, error } = await supabase.from("actions").select("id").eq("id", actionId).single();
  return !error && Boolean(data);
}

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const actionId = context.params.id;
  if (!actionId) {
    return jsonError({ code: ERROR_CODES.MISSING_ACTION_ID, message: "Action ID is required" }, 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError({ code: "INVALID_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const parseResult = patchActionSchema.safeParse(body);
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

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const existing = await actionExistsForUser(supabase, actionId);
  if (!existing) {
    return jsonError({ code: ERROR_CODES.ACTION_NOT_FOUND, message: "Action not found or access denied" }, 404);
  }

  const updates: {
    date?: string;
    additional_data?: string | null;
    weather_data?: Json | null;
  } = {};

  if (parseResult.data.additional_data !== undefined) {
    updates.additional_data = parseResult.data.additional_data;
  }

  if (parseResult.data.date !== undefined) {
    updates.date = parseResult.data.date;

    const { data: profile } = await supabase
      .from("profiles")
      .select("location_city")
      .eq("id", context.locals.user.id)
      .single();

    let weatherData: WeatherData | null = null;
    if (profile?.location_city && WEATHER_API_KEY) {
      const weatherService = new WeatherService(WEATHER_API_KEY);
      weatherData = await weatherService.getWeatherForDateByCity(
        toWeatherDate(parseResult.data.date),
        profile.location_city,
        supabase,
      );
    }

    updates.weather_data = weatherData as Json | null;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError({ code: ERROR_CODES.VALIDATION_ERROR, message: "No fields to update" }, 400);
  }

  const { data: action, error: updateError } = await supabase
    .from("actions")
    .update(updates)
    .eq("id", actionId)
    .select("id, plant_id, date, additional_data, weather_data, created_at")
    .single();

  if (updateError) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to update action",
        details: { error: updateError.message },
      },
      500,
    );
  }

  return Response.json({ success: true, action });
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const actionId = context.params.id;
  if (!actionId) {
    return jsonError({ code: ERROR_CODES.MISSING_ACTION_ID, message: "Action ID is required" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const existing = await actionExistsForUser(supabase, actionId);
  if (!existing) {
    return jsonError({ code: ERROR_CODES.ACTION_NOT_FOUND, message: "Action not found or access denied" }, 404);
  }

  const { error: deleteError } = await supabase.from("actions").delete().eq("id", actionId);

  if (deleteError) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to delete action",
        details: { error: deleteError.message },
      },
      500,
    );
  }

  return Response.json({ success: true });
};
