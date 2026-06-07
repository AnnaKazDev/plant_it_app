import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WeatherData } from "@/types";

export class WeatherError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WeatherError";
  }
}

export class WeatherService {
  constructor(private apiKey: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchWeatherForDate(_date: string, _latitude: number, _longitude: number): Promise<WeatherData | null> {
    // Phase 2 implementation
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getCachedWeather(_date: string, _supabase: SupabaseClient<Database>): Promise<WeatherData | null> {
    // Phase 2 implementation
    return null;
  }

  async getWeatherForDate(
    date: string,
    latitude: number,
    longitude: number,
    supabase: SupabaseClient<Database>,
  ): Promise<WeatherData | null> {
    // Check cache first
    const cached = await this.getCachedWeather(date, supabase);
    if (cached) return cached;

    // Fetch from API
    return await this.fetchWeatherForDate(date, latitude, longitude);
  }
}
