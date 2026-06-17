import { WeatherService, cityValidationErrorMessage } from "@/lib/weather";

export async function validateGardenCity(city: string, apiKey: string) {
  const weatherService = new WeatherService(apiKey);
  const result = await weatherService.validateCityName(city);

  if (result.valid) {
    return { ok: true as const };
  }

  return { ok: false as const, message: cityValidationErrorMessage(result) };
}
