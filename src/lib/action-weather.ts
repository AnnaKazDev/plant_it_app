import { WEATHER_API_KEY } from "astro:env/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WeatherError, WeatherService } from "@/lib/weather";
import type { ApiError, Database, WeatherData } from "@/types";
import { ERROR_CODES } from "@/types";

export interface ActionWeatherResult {
  weatherData: WeatherData | null;
  weatherError?: ApiError;
}

export function weatherErrorToApiError(error: WeatherError): ApiError {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

export async function fetchActionWeatherData(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string,
): Promise<ActionWeatherResult> {
  if (!WEATHER_API_KEY) {
    return { weatherData: null };
  }

  const { data: profile } = await supabase.from("profiles").select("location_city").eq("id", userId).single();

  if (!profile?.location_city) {
    return { weatherData: null };
  }

  try {
    const weatherService = new WeatherService(WEATHER_API_KEY);
    const weatherData = await weatherService.getWeatherForDateByCity(date, profile.location_city, supabase);
    return { weatherData };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Weather fetch failed during action save:", error);

    if (error instanceof WeatherError) {
      return { weatherData: null, weatherError: weatherErrorToApiError(error) };
    }

    return {
      weatherData: null,
      weatherError: {
        code: ERROR_CODES.WEATHER_API_UNAVAILABLE,
        message: "Failed to fetch weather data",
      },
    };
  }
}
