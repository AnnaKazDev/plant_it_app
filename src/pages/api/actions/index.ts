import type { APIRoute } from "astro";
import { z } from "zod";
import { WEATHER_API_KEY } from "astro:env/server";
import { createClient } from "@/lib/supabase";
import { WeatherService } from "@/lib/weather";
import type { Json } from "@/database.types";
import { ERROR_CODES } from "@/types";
import type { ApiError, WeatherData } from "@/types";

export const prerender = false;

const actionBodySchema = z
  .object({
    plant_id: z.uuid(),
    action_type_id: z.uuid().optional(),
    custom_action_name: z
      .string()
      .max(300)
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }),
    date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" }),
    additional_data: z
      .string()
      .max(1000)
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }),
  })
  .refine((data) => Boolean(data.action_type_id) !== Boolean(data.custom_action_name), {
    message: "Provide either action_type_id or custom_action_name, not both",
    path: ["action_type_id"],
  });

function jsonError(error: ApiError, status: number): Response {
  return Response.json({ error }, { status });
}

function toWeatherDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError({ code: "INVALID_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const parseResult = actionBodySchema.safeParse(body);
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

  const { plant_id, action_type_id, custom_action_name, date, additional_data } = parseResult.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const { data: plant } = await supabase.from("plants").select("id").eq("id", plant_id).single();

  if (!plant) {
    return jsonError({ code: ERROR_CODES.PLANT_NOT_FOUND, message: "Plant not found or access denied" }, 404);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("location_city")
    .eq("id", context.locals.user.id)
    .single();

  let weatherData: WeatherData | null = null;

  if (profile?.location_city && WEATHER_API_KEY) {
    const weatherService = new WeatherService(WEATHER_API_KEY);
    weatherData = await weatherService.getWeatherForDateByCity(toWeatherDate(date), profile.location_city, supabase);
  }

  const { data: action, error: insertError } = await supabase
    .from("actions")
    .insert({
      plant_id,
      action_type_id: action_type_id ?? null,
      custom_action_name: custom_action_name ?? null,
      date,
      additional_data: additional_data ?? null,
      weather_data: weatherData as Json | null,
    })
    .select("id, plant_id, action_type_id, custom_action_name, date, additional_data, weather_data, created_at")
    .single();

  if (insertError) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to create action",
        details: { error: insertError.message },
      },
      500,
    );
  }

  return Response.json(
    {
      success: true,
      action,
    },
    { status: 201 },
  );
};
