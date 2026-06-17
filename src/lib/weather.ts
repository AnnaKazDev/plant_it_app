import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WeatherData } from "@/types";

interface WeatherApiForecastDay {
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    maxwind_kph: number;
    totalprecip_mm: number;
    avghumidity: number;
    uv?: number;
    condition?: { text: string };
  };
  astro: {
    sunrise: string;
    sunset: string;
    moonrise: string;
    moonset: string;
    moon_phase: string;
  };
}

interface WeatherApiForecastResponse {
  current?: {
    temp_c: number;
    condition: { text: string; icon: string };
  };
  forecast: {
    forecastday: WeatherApiForecastDay[];
  };
}

export interface TodayWeatherInfo {
  current_temp_c: number | null;
  condition_text: string | null;
  condition_icon_url: string | null;
  forecast: WeatherData | null;
}

export function normalizeWeatherIconUrl(iconUrl: string): string {
  if (iconUrl.startsWith("//")) {
    return `https:${iconUrl}`;
  }
  return iconUrl;
}

/** WeatherAPI often fails on diacritics (e.g. Gdańsk); strip marks before API calls. */
export function normalizeCityNameForWeatherApi(cityName: string): string {
  return cityName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function mapForecastDayToWeatherData(forecastDay: WeatherApiForecastDay): WeatherData {
  const { day, astro } = forecastDay;

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
    ...(day.condition?.text ? { condition_text: day.condition.text } : {}),
    ...(typeof day.uv === "number" ? { uv: day.uv } : {}),
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

  private static readonly REQUEST_TIMEOUT_MS = 5000;

  private cityQuery(cityName: string): string {
    return encodeURIComponent(normalizeCityNameForWeatherApi(cityName));
  }

  async fetchWeatherForDate(date: string, latitude: number, longitude: number): Promise<WeatherData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const url = `https://api.weatherapi.com/v1/history.json?key=${this.apiKey}&q=${latitude},${longitude}&dt=${date}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as WeatherApiForecastResponse;

      if (!data.forecast.forecastday[0]) {
        // eslint-disable-next-line no-console
        console.error("Weather API response missing forecast data");
        return null;
      }

      const day = data.forecast.forecastday[0];

      return mapForecastDayToWeatherData(day);
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

      const url = `https://api.weatherapi.com/v1/history.json?key=${this.apiKey}&q=${this.cityQuery(cityName)}&dt=${date}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as WeatherApiForecastResponse;

      if (!data.forecast.forecastday[0]) {
        // eslint-disable-next-line no-console
        console.error("Weather API response missing forecast data");
        return null;
      }

      const day = data.forecast.forecastday[0];

      return mapForecastDayToWeatherData(day);
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

  async fetchTodayWeatherByCity(cityName: string): Promise<TodayWeatherInfo | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const url = `https://api.weatherapi.com/v1/forecast.json?key=${this.apiKey}&q=${this.cityQuery(cityName)}&days=1`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as WeatherApiForecastResponse;

      if (!data.forecast.forecastday[0]) {
        // eslint-disable-next-line no-console
        console.error("Weather API response missing forecast data");
        return null;
      }

      const forecastDay = data.forecast.forecastday[0];
      const forecast = mapForecastDayToWeatherData(forecastDay);

      return {
        current_temp_c: data.current?.temp_c ?? null,
        condition_text: data.current?.condition.text ?? forecast.condition_text ?? null,
        condition_icon_url: data.current?.condition.icon ? normalizeWeatherIconUrl(data.current.condition.icon) : null,
        forecast,
      };
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("Weather fetch error:", error.message);
      }
      return null;
    }
  }

  async validateCityName(cityName: string): Promise<CityValidationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, WeatherService.REQUEST_TIMEOUT_MS);

      const url = `https://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${this.cityQuery(cityName)}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401 || response.status === 403) {
        return { valid: false, reason: "api_key" };
      }

      try {
        const body = (await response.json()) as { error?: { code?: number } };
        if (body.error?.code === 1006) {
          return { valid: false, reason: "not_found" };
        }
      } catch {
        // Fall through to generic unavailable error.
      }

      if (response.status === 400) {
        return { valid: false, reason: "not_found" };
      }

      return { valid: false, reason: "unavailable" };
    } catch {
      return { valid: false, reason: "unavailable" };
    }
  }
}

export type CityValidationResult = { valid: true } | { valid: false; reason: "not_found" | "api_key" | "unavailable" };

export function cityValidationErrorMessage(result: Extract<CityValidationResult, { valid: false }>): string {
  switch (result.reason) {
    case "not_found":
      return 'City not found. Try a larger nearby city or add the country, e.g. "Warsaw" or "Krakow, Poland".';
    case "api_key":
      return "Weather service is misconfigured on the server. Please contact support.";
    case "unavailable":
      return "Could not validate the city right now. Please try again in a few minutes.";
  }
}
