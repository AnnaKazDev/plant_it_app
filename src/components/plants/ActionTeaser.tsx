import { ImageOff, Sprout } from "lucide-react";
import { formatActionDate, isPlannedAction } from "@/lib/action-dates";
import type { PlantCardAction } from "@/lib/plant-page";
import type { WeatherData } from "@/types";
import { cn } from "@/lib/utils";

interface ActionTeaserProps {
  action: PlantCardAction;
}

function formatWeather(weather: WeatherData | null): string {
  if (!weather) {
    return "Weather unavailable";
  }

  return `${String(weather.temp_min)}–${String(weather.temp_max)}°C, rain ${String(weather.precip)} mm`;
}

export function getActionLabel(action: PlantCardAction): string {
  if (action.action_type) {
    return `${action.action_type.icon_emoji} ${action.action_type.name.replace(/_/g, " ")}`;
  }

  return action.custom_action_name ?? "Action";
}

export default function ActionTeaser({ action }: ActionTeaserProps) {
  const firstPhoto = action.photos.length > 0 ? action.photos[0] : undefined;
  const planned = isPlannedAction(action.date);

  return (
    <article className="border-border bg-card/40 flex gap-4 rounded-xl border p-4">
      <div
        className={cn(
          "bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg",
          !firstPhoto && "text-muted-foreground",
        )}
      >
        {firstPhoto ? (
          <img src={firstPhoto.signed_photo_url} alt="" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-8" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground font-medium capitalize">{getActionLabel(action)}</h3>
          {planned ? (
            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              Planned
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{formatActionDate(action.date)}</p>
        {action.additional_data ? <p className="text-muted-foreground text-sm">{action.additional_data}</p> : null}
        <p className="text-muted-foreground text-sm">{formatWeather(action.weather_data)}</p>
      </div>
    </article>
  );
}

export function PlantAvatar({ signedPhotoUrl, alt }: { signedPhotoUrl: string | null; alt: string }) {
  return (
    <div className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
      {signedPhotoUrl ? (
        <img src={signedPhotoUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <Sprout className="size-10" aria-hidden />
      )}
    </div>
  );
}
