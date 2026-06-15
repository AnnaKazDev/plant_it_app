import { Plus } from "lucide-react";
import ActionTeaser, { EmptyActionTeaser, plannedBadgeClass, teaserElevationClass } from "@/components/plants/ActionTeaser";
import { Button } from "@/components/ui/button";
import type { PlantListItem as PlantListItemData } from "@/lib/plant-page";
import { cn } from "@/lib/utils";

interface PlantListItemProps {
  plant: PlantListItemData;
}

export default function PlantListItem({ plant }: PlantListItemProps) {
  return (
    <article
      className={cn(
        "border-border bg-card/40 rounded-xl border p-4",
        teaserElevationClass,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <a
          href={`/plants/${plant.id}`}
          className="hover:bg-card/60 focus-visible:ring-ring -m-1 flex min-w-0 flex-wrap items-center gap-2 rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <h2 className="text-foreground text-lg font-semibold">{plant.display_name}</h2>
          {plant.planned_action_count > 0 ? (
            <span className={plannedBadgeClass}>
              {plant.planned_action_count} planned
            </span>
          ) : null}
        </a>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <a href={`/plants/${plant.id}#add-action`}>
            <Plus className="size-4" />
            Add action
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {plant.last_action ? "Last activity" : "No activity yet"}
        </p>
        <a
          href={`/plants/${plant.id}`}
          className="hover:bg-card/60 focus-visible:ring-ring -m-1 block rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {plant.last_action ? (
            <ActionTeaser action={plant.last_action} nested />
          ) : (
            <EmptyActionTeaser signedPhotoUrl={plant.signed_photo_url} alt={plant.display_name} nested />
          )}
        </a>
      </div>
    </article>
  );
}
