import type { ReactNode } from "react";
import { formatActionDate, isPlannedAction } from "@/lib/action-dates";
import type { PlantCardAction } from "@/lib/plant-page";
import type { WeatherData } from "@/types";
import { cn } from "@/lib/utils";

interface ActionTeaserProps {
  action: PlantCardAction;
  nested?: boolean;
}

export const PLANT_PLACEHOLDER_ICON = "/plant_it_icon.png";

export function PlantPlaceholderImage({ alt = "" }: { alt?: string }) {
  return <img src={PLANT_PLACEHOLDER_ICON} alt={alt} className="size-full object-contain p-1.5" />;
}

export const teaserElevationClass =
  "shadow-md dark:shadow-[0_4px_20px_-2px_color-mix(in_oklch,var(--primary)_35%,transparent)]";

function TeaserLayout({
  image,
  children,
  nested = false,
}: {
  image: ReactNode;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <article
      className={cn(
        "border-border bg-card/40 flex gap-4 rounded-xl p-2",
        !nested && teaserElevationClass,
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-30 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {image}
      </div>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </article>
  );
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

export default function ActionTeaser({ action, nested = false }: ActionTeaserProps) {
  const firstPhoto = action.photos.length > 0 ? action.photos[0] : undefined;
  const planned = isPlannedAction(action.date);

  return (
    <TeaserLayout
      nested={nested}
      image={
        firstPhoto ? (
          <img src={firstPhoto.signed_photo_url} alt="" className="size-full object-cover" />
        ) : (
          <PlantPlaceholderImage />
        )
      }
    >
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
    </TeaserLayout>
  );
}

export function EmptyActionTeaser({
  signedPhotoUrl,
  alt,
  nested = false,
}: {
  signedPhotoUrl: string | null;
  alt: string;
  nested?: boolean;
}) {
  return (
    <TeaserLayout
      nested={nested}
      image={
        signedPhotoUrl ? (
          <img src={signedPhotoUrl} alt={alt} className="size-full object-cover" />
        ) : (
          <PlantPlaceholderImage alt={alt} />
        )
      }
    >
      <h3 className="text-foreground font-medium">No actions yet</h3>
      <p className="text-muted-foreground text-sm">Add an action to start tracking this plant.</p>
    </TeaserLayout>
  );
}

export function PlantAvatar({ signedPhotoUrl, alt }: { signedPhotoUrl: string | null; alt: string }) {
  return (
    <div className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
      {signedPhotoUrl ? (
        <img src={signedPhotoUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <PlantPlaceholderImage alt={alt} />
      )}
    </div>
  );
}
