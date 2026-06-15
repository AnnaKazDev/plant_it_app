import { useState } from "react";
import { formatActionDate, isPlannedAction } from "@/lib/action-dates";
import type { PlantCardAction } from "@/lib/plant-page";
import ActionWeatherInfo from "@/components/plants/ActionWeatherInfo";
import { cn } from "@/lib/utils";
import PhotoLightbox from "@/components/plants/PhotoLightbox";
import {
  getActionLabel,
  PlantPlaceholderImage,
  plannedBadgeClass,
  teaserElevationClass,
} from "@/components/plants/ActionTeaser";

interface ActionTeaserCardProps {
  action: PlantCardAction;
  nested?: boolean;
}

export default function ActionTeaserCard({ action, nested = false }: ActionTeaserCardProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const planned = isPlannedAction(action.date);
  const firstPhoto = action.photos.at(0);

  return (
    <>
      <article className={cn("border-border bg-card/40 flex gap-4 rounded-xl p-2", !nested && teaserElevationClass)}>
        <button
          type="button"
          className="bg-muted text-muted-foreground flex size-30 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          onClick={() => {
            if (firstPhoto) {
              setLightboxIndex(0);
            }
          }}
          disabled={!firstPhoto}
          aria-label={firstPhoto ? "Open photo gallery" : undefined}
        >
          {firstPhoto ? (
            <img src={firstPhoto.signed_photo_url} alt="" className="size-full object-cover" />
          ) : (
            <PlantPlaceholderImage />
          )}
        </button>

        <div className="flex min-h-30 min-w-0 flex-1 flex-col">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-foreground font-medium capitalize">{getActionLabel(action)}</h3>
              {planned ? <span className={plannedBadgeClass}>Planned</span> : null}
            </div>

            <p className="text-muted-foreground text-sm">{formatActionDate(action.date)}</p>

            {action.additional_data ? (
              <p className="text-muted-foreground text-sm">{action.additional_data}</p>
            ) : null}

            {action.photos.length > 1 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {action.photos.map((photo, photoIndex) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="border-border size-12 overflow-hidden rounded-md border"
                    onClick={() => {
                      setLightboxIndex(photoIndex);
                    }}
                    aria-label={`View photo ${String(photoIndex + 1)} of ${String(action.photos.length)}`}
                  >
                    <img src={photo.signed_photo_url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {!planned ? (
            <div className="border-border/60 mt-auto border-t pt-2">
              <ActionWeatherInfo weather={action.weather_data} />
            </div>
          ) : null}
        </div>
      </article>

      {lightboxIndex !== null ? (
        <PhotoLightbox
          photos={action.photos}
          initialIndex={lightboxIndex}
          onClose={() => {
            setLightboxIndex(null);
          }}
        />
      ) : null}
    </>
  );
}
