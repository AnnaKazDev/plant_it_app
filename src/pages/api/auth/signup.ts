import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient, createServiceRoleClient, getSupabaseKeyRole } from "@/lib/supabase";
import { SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";
import { WeatherService } from "@/lib/weather";
import { WEATHER_API_KEY } from "astro:env/server";

export const prerender = false;

const signupSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  city: z.string().min(2, "City name must be at least 2 characters").max(100, "City name too long"),
  garden_name: z.string().min(1, "Garden name is required").max(100, "Garden name too long"),
  garden_width: z.coerce.number().min(0.1, "Width must be at least 0.1m").max(100, "Width must be at most 100m"),
  garden_height: z.coerce.number().min(0.1, "Height must be at least 0.1m").max(100, "Height must be at most 100m"),
});

export const POST: APIRoute = async (context) => {
  // Parse form data
  const form = await context.request.formData();

  // Validate input
  const parseResult = signupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    city: form.get("city"),
    garden_name: form.get("garden_name"),
    garden_width: form.get("garden_width"),
    garden_height: form.get("garden_height"),
  });

  if (!parseResult.success) {
    const errorMessage = parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return context.redirect(`/auth/signup?error=${encodeURIComponent(errorMessage)}`);
  }

  const { email, password, city, garden_name, garden_width, garden_height } = parseResult.data;

  if (!WEATHER_API_KEY) {
    return context.redirect(
      `/auth/signup?error=${encodeURIComponent("Weather API is not configured. Please contact support.")}`,
    );
  }

  const weatherService = new WeatherService(WEATHER_API_KEY);
  const isCityValid = await weatherService.validateCityName(city);

  if (!isCityValid) {
    return context.redirect(
      `/auth/signup?error=${encodeURIComponent("City not found or could not be validated. Please check the city name.")}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const adminSupabase = createServiceRoleClient();
  if (!adminSupabase) {
    const role = SUPABASE_SERVICE_ROLE_KEY ? getSupabaseKeyRole(SUPABASE_SERVICE_ROLE_KEY) : null;
    const message =
      role && role !== "service_role"
        ? "Server configuration error: invalid Supabase service role key. Please contact support."
        : "Server configuration error. Please contact support.";
    return context.redirect(`/auth/signup?error=${encodeURIComponent(message)}`);
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError) {
    const authMessage = authError.message.toLowerCase();
    // Account may already exist from a previous attempt — guide user to confirm email instead of a dead-end error.
    if (authMessage.includes("rate limit") || authMessage.includes("already registered")) {
      return context.redirect("/auth/confirm-email?reason=pending");
    }
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authError.message)}`);
  }

  if (!authData.user) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Signup succeeded but user data is missing")}`);
  }

  // Service role bypasses RLS — required when email confirmation is enabled (no session after signUp).
  const { error: profileError } = await adminSupabase.from("profiles").upsert(
    {
      id: authData.user.id,
      location_city: city,
      garden_name,
      garden_width,
      garden_height,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("Profile upsert failed during signup:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
    return context.redirect(
      `/auth/signup?error=${encodeURIComponent("Failed to create profile. Please try again or contact support.")}`,
    );
  }

  // Success - redirect to confirm email
  return context.redirect("/auth/confirm-email");
};
