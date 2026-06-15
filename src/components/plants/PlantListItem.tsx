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
      <a
        href={`/plants/${plant.id}`}
        className="hover:bg-card/60 focus-visible:ring-ring -m-1 mb-3 flex flex-wrap items-center gap-2 rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <h2 className="text-foreground text-lg font-semibold">{plant.display_name}</h2>
        {plant.planned_action_count > 0 ? (
          <span className={plannedBadgeClass}>
            {plant.planned_action_count} planned
          </span>
        ) : null}
      </a>

      <div className="relative">
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
        <Button asChild size="sm" className="absolute right-1 bottom-1 z-10 shadow-sm">
          <a href={`/plants/${plant.id}#add-action`}>
            <Plus className="size-4" />
            Add action
          </a>
        </Button>
      </div>
    </article>
  );
}
