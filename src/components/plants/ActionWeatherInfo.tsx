import { Droplets, Moon, Sun, Wind } from "lucide-react";
import { formatWeatherSummary, getWeatherDetailLines, type WeatherDetailIcon } from "@/lib/weather-display";
import type { WeatherData } from "@/types";

interface ActionWeatherInfoProps {
  weather: WeatherData | null;
}

function WeatherDetailIcon({ icon }: { icon: WeatherDetailIcon }) {
  switch (icon) {
    case "droplets":
      return <Droplets className="size-3 shrink-0" aria-hidden />;
    case "wind":
      return <Wind className="size-3 shrink-0" aria-hidden />;
    case "moon":
      return <Moon className="size-3 shrink-0" aria-hidden />;
    case "sun":
    case "uv":
      return <Sun className="size-3 shrink-0" aria-hidden />;
  }
}

export default function ActionWeatherInfo({ weather }: ActionWeatherInfoProps) {
  const details = getWeatherDetailLines(weather);

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{formatWeatherSummary(weather)}</p>
      {details.length > 0 ? (
        <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {details.map((detail) => (
            <li key={detail.label} className="inline-flex items-center gap-1">
              <WeatherDetailIcon icon={detail.icon} />
              {detail.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
