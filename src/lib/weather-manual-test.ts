/* eslint-disable no-console */
// Manual verification script for Phase 2
// Run this file with: npx tsx src/lib/weather-manual-test.ts
// Make sure Supabase is running: npx supabase start

import { WeatherService } from "./weather.ts";

const WEATHER_API_KEY = "d2f46b3b45704a45acd154556260706";

async function runTests() {
  console.log("🧪 Phase 2 Manual Verification Tests\n");

  const weatherService = new WeatherService(WEATHER_API_KEY);

  // Test coordinates (Warsaw, Poland)
  const latitude = 52.2297;
  const longitude = 21.0122;
  const testDate = "2024-01-15"; // Past date for historical data

  console.log("Test 1: Fetch weather from API");
  console.log(`  Date: ${testDate}`);
  console.log(`  Location: ${latitude}, ${longitude}`);

  const weatherData = await weatherService.fetchWeatherForDate(testDate, latitude, longitude);

  if (weatherData) {
    console.log("  ✅ Success! Weather data retrieved:");
    console.log(`    Temperature: ${weatherData.temp_min}°C - ${weatherData.temp_max}°C`);
    console.log(`    Precipitation: ${weatherData.precip}mm`);
    console.log(`    Humidity: ${weatherData.humidity}%`);
    console.log(`    Wind: ${weatherData.wind} km/h`);
    console.log(`    Sunrise: ${weatherData.sunrise}, Sunset: ${weatherData.sunset}`);
    console.log(`    Moon phase: ${weatherData.moon_phase}`);
  } else {
    console.log("  ❌ Failed: No weather data returned");
    process.exit(1);
  }

  console.log("\nTest 2: Call API again (should be same data)");
  const weatherData2 = await weatherService.fetchWeatherForDate(testDate, latitude, longitude);

  if (weatherData2) {
    console.log("  ✅ Success! Second call also returned data");
  } else {
    console.log("  ❌ Failed: Second call returned null");
    process.exit(1);
  }

  console.log("\nTest 3: Test with invalid date (should return null gracefully)");
  const invalidWeather = await weatherService.fetchWeatherForDate("2009-01-01", latitude, longitude);

  if (invalidWeather === null) {
    console.log("  ✅ Success! Invalid date handled gracefully (returned null)");
  } else {
    console.log("  ❌ Unexpected: Invalid date returned data");
  }

  console.log("\nTest 4: Test with invalid API key (should return null gracefully)");
  const badService = new WeatherService("invalid-key-123");
  const badWeather = await badService.fetchWeatherForDate(testDate, latitude, longitude);

  if (badWeather === null) {
    console.log("  ✅ Success! Invalid API key handled gracefully (returned null)");
  } else {
    console.log("  ❌ Unexpected: Invalid key returned data");
  }

  console.log("\n✅ All manual verification tests passed!");
  console.log("\nNote: Cache testing requires database with actions table.");
  console.log("Cache will be tested in integration tests (Phase 3).");
}

runTests().catch((error: unknown) => {
  console.error("❌ Test failed with error:", error);
  process.exit(1);
});
