import type { WeatherData } from "@/types";

export function formatWeatherSummary(weather: WeatherData | null): string {
  if (!weather) {
    return "Weather unavailable";
  }

  const temps = `${String(weather.temp_min)}–${String(weather.temp_max)}°C, rain ${String(weather.precip)} mm`;
  const condition =
    typeof weather.condition_text === "string" && weather.condition_text.length > 0 ? weather.condition_text : null;

  return condition ? `${condition} · ${temps}` : temps;
}

export type WeatherDetailIcon = "droplets" | "wind" | "moon" | "sun" | "uv";

export interface WeatherDetailLine {
  icon: WeatherDetailIcon;
  label: string;
}

export function getWeatherDetailLines(weather: WeatherData | null): WeatherDetailLine[] {
  if (!weather) {
    return [];
  }

  const lines: WeatherDetailLine[] = [];

  if (typeof weather.humidity === "number") {
    lines.push({ icon: "droplets", label: `${String(weather.humidity)}% humidity` });
  }

  if (typeof weather.wind === "number") {
    lines.push({ icon: "wind", label: `${String(weather.wind)} km/h wind` });
  }

  if (typeof weather.uv === "number") {
    lines.push({ icon: "uv", label: `UV ${String(weather.uv)}` });
  }

  if (typeof weather.moon_phase === "string" && weather.moon_phase.length > 0) {
    lines.push({ icon: "moon", label: weather.moon_phase });
  }

  if (
    typeof weather.sunrise === "string" &&
    weather.sunrise.length > 0 &&
    typeof weather.sunset === "string" &&
    weather.sunset.length > 0
  ) {
    lines.push({ icon: "sun", label: `${weather.sunrise} – ${weather.sunset}` });
  }

  return lines;
}
