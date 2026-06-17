import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { parseGardenProfileForm } from "@/lib/profile-schema";
import { upsertGardenProfile } from "@/lib/profile";
import { WeatherService } from "@/lib/weather";
import { WEATHER_API_KEY } from "astro:env/server";

export const prerender = false;

const SETUP_PATH = "/garden/setup";

function redirectWithError(message: string, next?: string | null) {
  const params = new URLSearchParams({ error: message });
  if (next) {
    params.set("next", next);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `${SETUP_PATH}?${params.toString()}` },
  });
}

export const POST: APIRoute = async (context) => {
  const next = context.url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError("Supabase is not configured", safeNext);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInParams = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    return context.redirect(`/auth/signin${signInParams}`);
  }

  const form = await context.request.formData();
  const parseResult = parseGardenProfileForm(form);

  if (!parseResult.success) {
    const errorMessage = parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return redirectWithError(errorMessage, safeNext);
  }

  if (!WEATHER_API_KEY) {
    return redirectWithError("Weather API is not configured. Please contact support.", safeNext);
  }

  const weatherService = new WeatherService(WEATHER_API_KEY);
  const isCityValid = await weatherService.validateCityName(parseResult.data.city);

  if (!isCityValid) {
    return redirectWithError("City not found or could not be validated. Please check the city name.", safeNext);
  }

  const { error: profileError } = await upsertGardenProfile(supabase, user.id, parseResult.data);

  if (profileError) {
    return redirectWithError("Failed to save garden setup. Please try again or contact support.", safeNext);
  }

  return context.redirect(safeNext ?? "/plants/new");
};
