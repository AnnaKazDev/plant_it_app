import { SUPABASE_URL, SUPABASE_KEY, WEATHER_API_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "Weather API",
    configured: Boolean(WEATHER_API_KEY),
    message: "Weather API nie jest skonfigurowany — dane pogodowe nie będą dostępne.",
    docsUrl: "https://www.weatherapi.com/signup.aspx",
    docsLabel: "Zarejestruj się na WeatherAPI.com",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
