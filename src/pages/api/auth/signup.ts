import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
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

  // Create Supabase client
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authError.message)}`);
  }

  if (!authData.user) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Signup succeeded but user data is missing")}`);
  }

  // Validate city name via WeatherAPI
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

  // Create profile row
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    location_city: city,
    garden_name,
    garden_width,
    garden_height,
  });

  if (profileError) {
    return context.redirect(
      `/auth/signup?error=${encodeURIComponent("Failed to create profile. Please try again or contact support.")}`,
    );
  }

  // Success - redirect to confirm email
  return context.redirect("/auth/confirm-email");
};
