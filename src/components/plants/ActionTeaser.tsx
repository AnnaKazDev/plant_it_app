import type { ReactNode } from "react";
import { formatActionDate, isPlannedAction } from "@/lib/action-dates";
import type { PlantCardAction } from "@/lib/plant-page";
import ActionWeatherInfo from "@/components/plants/ActionWeatherInfo";
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

export const plannedBadgeClass =
  "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-300/70 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-400/40";

function TeaserLayout({
  image,
  children,
  footer,
  nested = false,
}: {
  image: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  nested?: boolean;
}) {
  return (
    <article className={cn("border-border bg-card/40 flex gap-4 rounded-xl p-2", !nested && teaserElevationClass)}>
      <div className="bg-muted text-muted-foreground flex size-30 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {image}
      </div>
      <div className="flex min-h-30 min-w-0 flex-1 flex-col">
        <div className="space-y-1">{children}</div>
        {footer ? <div className="border-border/60 mt-auto border-t pt-2">{footer}</div> : null}
      </div>
    </article>
  );
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
      footer={!planned ? <ActionWeatherInfo weather={action.weather_data} /> : undefined}
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
        {planned ? <span className={plannedBadgeClass}>Planned</span> : null}
      </div>
      <p className="text-muted-foreground text-sm">{formatActionDate(action.date)}</p>
      {action.additional_data ? <p className="text-muted-foreground text-sm">{action.additional_data}</p> : null}
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

export function PlantAvatar({
  signedPhotoUrl,
  alt,
  className,
}: {
  signedPhotoUrl: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
    >
      {signedPhotoUrl ? (
        <img src={signedPhotoUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <PlantPlaceholderImage alt={alt} />
      )}
    </div>
  );
}
