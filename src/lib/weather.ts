import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WeatherData } from "@/types";

interface WeatherApiResponse {
  forecast: {
    forecastday: {
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        avghumidity: number;
      };
      astro: {
        sunrise: string;
        sunset: string;
        moonrise: string;
        moonset: string;
        moon_phase: string;
      };
    }[];
  };
}

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

  async fetchWeatherForDate(date: string, latitude: number, longitude: number): Promise<WeatherData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const url = `http://api.weatherapi.com/v1/history.json?key=${this.apiKey}&q=${latitude},${longitude}&dt=${date}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as WeatherApiResponse;

      if (!data.forecast.forecastday[0]) {
        // eslint-disable-next-line no-console
        console.error("Weather API response missing forecast data");
        return null;
      }

      const day = data.forecast.forecastday[0].day;
      const astro = data.forecast.forecastday[0].astro;

      return {
        temp_max: day.maxtemp_c,
        temp_min: day.mintemp_c,
        wind: day.maxwind_kph,
        precip: day.totalprecip_mm,
        humidity: day.avghumidity,
        sunrise: astro.sunrise,
        sunset: astro.sunset,
        moonrise: astro.moonrise,
        moonset: astro.moonset,
        moon_phase: astro.moon_phase,
      };
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("Weather fetch error:", error.message);
      }
      return null;
    }
  }

  async getCachedWeather(date: string, supabase: SupabaseClient<Database>): Promise<WeatherData | null> {
    try {
      const { data, error } = await supabase
        .from("actions")
        .select("weather_data")
        .eq("date", date)
        .not("weather_data", "is", null)
        .limit(1)
        .single();

      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, @typescript-eslint/no-unnecessary-condition
      if (error || !data || !data.weather_data) {
        return null;
      }

      return data.weather_data as WeatherData;
    } catch {
      return null;
    }
  }

  async fetchWeatherForDateByCity(date: string, cityName: string): Promise<WeatherData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const url = `http://api.weatherapi.com/v1/history.json?key=${this.apiKey}&q=${encodeURIComponent(cityName)}&dt=${date}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as WeatherApiResponse;

      if (!data.forecast.forecastday[0]) {
        // eslint-disable-next-line no-console
        console.error("Weather API response missing forecast data");
        return null;
      }

      const day = data.forecast.forecastday[0].day;
      const astro = data.forecast.forecastday[0].astro;

      return {
        temp_max: day.maxtemp_c,
        temp_min: day.mintemp_c,
        wind: day.maxwind_kph,
        precip: day.totalprecip_mm,
        humidity: day.avghumidity,
        sunrise: astro.sunrise,
        sunset: astro.sunset,
        moonrise: astro.moonrise,
        moonset: astro.moonset,
        moon_phase: astro.moon_phase,
      };
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("Weather fetch error:", error.message);
      }
      return null;
    }
  }

  async getWeatherForDateByCity(
    date: string,
    cityName: string,
    supabase: SupabaseClient<Database>,
  ): Promise<WeatherData | null> {
    const cached = await this.getCachedWeather(date, supabase);
    if (cached) return cached;

    return await this.fetchWeatherForDateByCity(date, cityName);
  }

  async getWeatherForDate(
    date: string,
    latitude: number,
    longitude: number,
    supabase: SupabaseClient<Database>,
  ): Promise<WeatherData | null> {
    const cached = await this.getCachedWeather(date, supabase);
    if (cached) return cached;

    return await this.fetchWeatherForDate(date, latitude, longitude);
  }

  async validateCityName(cityName: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const url = `http://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${encodeURIComponent(cityName)}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch {
      return false;
    }
  }
}
