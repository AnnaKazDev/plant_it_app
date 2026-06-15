import { compareActionsByDateAsc, formatActionDate, isPlannedAction } from "@/lib/action-dates";
import type { PlantCardAction } from "@/lib/plant-page";
import { getActionLabel, PlantPlaceholderImage } from "@/components/plants/ActionTeaser";
import { cn } from "@/lib/utils";

interface GrowthTimelineProps {
  actions: PlantCardAction[];
}

export default function GrowthTimeline({ actions }: GrowthTimelineProps) {
  const chronological = actions.filter((action) => !isPlannedAction(action.date)).sort(compareActionsByDateAsc);

  if (chronological.length < 2) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Growth story">
      <h2 className="text-foreground text-lg font-semibold">Growth story</h2>
      <p className="text-muted-foreground text-sm">
        A visual journey through {chronological.length} recorded stages — oldest to newest.
      </p>

      <div className="relative overflow-x-auto pb-2">
        <ol className="flex min-w-max items-start gap-0 px-1">
          {chronological.map((action, index) => {
            const firstPhoto = action.photos.at(0);
            const isLast = index === chronological.length - 1;

            return (
              <li key={action.id} className="flex items-start">
                <div className="flex w-28 flex-col items-center gap-2">
                  <div
                    className={cn(
                      "border-border bg-muted relative size-16 overflow-hidden rounded-lg border-2",
                      index === chronological.length - 1 && "border-primary ring-primary/30 ring-2",
                    )}
                  >
                    {firstPhoto ? (
                      <img src={firstPhoto.signed_photo_url} alt="" className="size-full object-cover" />
                    ) : (
                      <PlantPlaceholderImage />
                    )}
                  </div>
                  <div className="space-y-0.5 text-center">
                    <p className="text-foreground line-clamp-2 text-xs font-medium capitalize">
                      {getActionLabel(action)}
                    </p>
                    <p className="text-muted-foreground text-[11px]">{formatActionDate(action.date)}</p>
                  </div>
                </div>

                {!isLast ? (
                  <div className="text-primary mt-8 flex h-0.5 w-8 shrink-0 items-center" aria-hidden>
                    <div className="bg-primary/40 h-0.5 w-full" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
