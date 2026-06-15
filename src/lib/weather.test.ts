/**
 * Integration tests for WeatherService
 *
 * Uses mocked fetch() to avoid hitting the real WeatherAPI.com API during tests.
 * Cache tests use the real Supabase test database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { WeatherService } from "./weather";
import { seedTestData, cleanupTestData, createTestClient } from "@/lib/test-utils";
import type { Json } from "@/database.types";
import type { WeatherData } from "@/types";

describe("WeatherService", () => {
  const TEST_API_KEY = "test-api-key-123";
  const TEST_DATE = "2024-01-15";
  const TEST_LAT = 52.2297;
  const TEST_LON = 21.0122;

  let weatherService: WeatherService;
  let testData: Awaited<ReturnType<typeof seedTestData>> | undefined;
  let supabase: ReturnType<typeof createTestClient>;

  beforeAll(async () => {
    testData = await seedTestData();
    supabase = createTestClient(true);
  });

  afterAll(async () => {
    if (testData?.userId) {
      await cleanupTestData(testData.userId);
    }
  });

  beforeEach(() => {
    weatherService = new WeatherService(TEST_API_KEY);
    vi.restoreAllMocks();
  });

  describe("fetchWeatherForDate()", () => {
    it("should fetch and parse weather data successfully", async () => {
      const mockResponse = {
        forecast: {
          forecastday: [
            {
              day: {
                maxtemp_c: 15.5,
                mintemp_c: 8.2,
                maxwind_kph: 25.3,
                totalprecip_mm: 2.4,
                avghumidity: 75,
                uv: 4.2,
                condition: { text: "Partly cloudy" },
              },
              astro: {
                sunrise: "06:45 AM",
                sunset: "06:30 PM",
                moonrise: "08:15 PM",
                moonset: "07:20 AM",
                moon_phase: "Waxing Gibbous",
              },
            },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => Promise.resolve(mockResponse),
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toEqual({
        temp_max: 15.5,
        temp_min: 8.2,
        wind: 25.3,
        precip: 2.4,
        humidity: 75,
        sunrise: "06:45 AM",
        sunset: "06:30 PM",
        moonrise: "08:15 PM",
        moonset: "07:20 AM",
        moon_phase: "Waxing Gibbous",
        condition_text: "Partly cloudy",
        uv: 4.2,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.weatherapi.com/v1/history.json?key=${TEST_API_KEY}&q=${TEST_LAT},${TEST_LON}&dt=${TEST_DATE}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });

    it("should return null on 401 Unauthorized (invalid key)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });

    it("should return null on 404 Not Found (no data for date)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });

    it("should return null on 500 Server Error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });

    it("should return null on malformed JSON response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });

    it("should return null when forecast data is missing", async () => {
      const mockResponse = {
        forecast: {
          forecastday: [],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => Promise.resolve(mockResponse),
      });

      const result = await weatherService.fetchWeatherForDate(TEST_DATE, TEST_LAT, TEST_LON);

      expect(result).toBeNull();
    });
  });

  describe("getCachedWeather()", () => {
    it("should return cached weather data when available", async () => {
      if (!testData) {
        throw new Error("Test data not initialized");
      }

      const weatherData: WeatherData = {
        temp_max: 20.5,
        temp_min: 12.3,
        wind: 15.2,
        precip: 0,
        humidity: 65,
        sunrise: "06:00 AM",
        sunset: "07:00 PM",
        moonrise: "09:00 PM",
        moonset: "08:00 AM",
        moon_phase: "Full Moon",
      };

      // Insert action with weather data
      const { error: insertError } = await supabase.from("actions").insert({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        date: TEST_DATE,
        weather_data: weatherData as Json,
      });

      // Skip test if database insert fails (e.g., Supabase not running)
      if (insertError) {
        // eslint-disable-next-line no-console
        console.warn("Skipping cache test: database insert failed", insertError.message);
        return;
      }

      const result = await weatherService.getCachedWeather(TEST_DATE, supabase);

      expect(result).toEqual(weatherData);
    });

    it("should return null when no cached data exists", async () => {
      const result = await weatherService.getCachedWeather("2099-12-31", supabase);

      expect(result).toBeNull();
    });
  });

  describe("fetchTodayWeatherByCity()", () => {
    it("should fetch current and today forecast weather", async () => {
      const mockResponse = {
        current: {
          temp_c: 11.5,
          condition: { text: "Partly cloudy", icon: "//cdn.weatherapi.com/weather/64x64/day/116.png" },
        },
        forecast: {
          forecastday: [
            {
              day: {
                maxtemp_c: 15.5,
                mintemp_c: 8.2,
                maxwind_kph: 25.3,
                totalprecip_mm: 2.4,
                avghumidity: 75,
                uv: 3.5,
                condition: { text: "Partly cloudy" },
              },
              astro: {
                sunrise: "06:45 AM",
                sunset: "06:30 PM",
                moonrise: "08:15 PM",
                moonset: "07:20 AM",
                moon_phase: "Waxing Gibbous",
              },
            },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => Promise.resolve(mockResponse),
      });

      const result = await weatherService.fetchTodayWeatherByCity("Warsaw");

      expect(result).toEqual({
        current_temp_c: 11.5,
        condition_text: "Partly cloudy",
        condition_icon_url: "https://cdn.weatherapi.com/weather/64x64/day/116.png",
        forecast: {
          temp_max: 15.5,
          temp_min: 8.2,
          wind: 25.3,
          precip: 2.4,
          humidity: 75,
          sunrise: "06:45 AM",
          sunset: "06:30 PM",
          moonrise: "08:15 PM",
          moonset: "07:20 AM",
          moon_phase: "Waxing Gibbous",
          condition_text: "Partly cloudy",
          uv: 3.5,
        },
      });
    });
  });

  describe("getWeatherForDate()", () => {
    it("should use cache first when available", async () => {
      if (!testData) {
        throw new Error("Test data not initialized");
      }

      const cachedWeather: WeatherData = {
        temp_max: 18.0,
        temp_min: 10.0,
        wind: 12.0,
        precip: 1.5,
        humidity: 70,
        sunrise: "06:30 AM",
        sunset: "06:45 PM",
        moonrise: "08:30 PM",
        moonset: "07:30 AM",
        moon_phase: "Waning Crescent",
      };

      // Insert cached action
      const { error: insertError } = await supabase.from("actions").insert({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        date: "2024-02-20",
        weather_data: cachedWeather as Json,
      });

      // Skip test if database insert fails (e.g., Supabase not running)
      if (insertError) {
        // eslint-disable-next-line no-console
        console.warn("Skipping cache test: database insert failed", insertError.message);
        return;
      }

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const result = await weatherService.getWeatherForDate("2024-02-20", TEST_LAT, TEST_LON, supabase);

      expect(result).toEqual(cachedWeather);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should fallback to API when cache miss", async () => {
      const apiWeather = {
        forecast: {
          forecastday: [
            {
              day: {
                maxtemp_c: 22.0,
                mintemp_c: 14.0,
                maxwind_kph: 18.5,
                totalprecip_mm: 0.5,
                avghumidity: 60,
                uv: 6,
                condition: { text: "Sunny" },
              },
              astro: {
                sunrise: "06:15 AM",
                sunset: "07:15 PM",
                moonrise: "09:30 PM",
                moonset: "08:30 AM",
                moon_phase: "New Moon",
              },
            },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => Promise.resolve(apiWeather),
      });

      const result = await weatherService.getWeatherForDate("2024-03-15", TEST_LAT, TEST_LON, supabase);

      expect(result).toEqual({
        temp_max: 22.0,
        temp_min: 14.0,
        wind: 18.5,
        precip: 0.5,
        humidity: 60,
        sunrise: "06:15 AM",
        sunset: "07:15 PM",
        moonrise: "09:30 PM",
        moonset: "08:30 AM",
        moon_phase: "New Moon",
        condition_text: "Sunny",
        uv: 6,
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
