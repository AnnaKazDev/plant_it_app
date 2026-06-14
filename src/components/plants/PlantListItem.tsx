import ActionTeaser, { EmptyActionTeaser, teaserElevationClass } from "@/components/plants/ActionTeaser";
import type { PlantListItem as PlantListItemData } from "@/lib/plant-page";
import { cn } from "@/lib/utils";

interface PlantListItemProps {
  plant: PlantListItemData;
}

export default function PlantListItem({ plant }: PlantListItemProps) {
  return (
    <a
      href={`/plants/${plant.id}`}
      className={cn(
        "border-border bg-card/40 block rounded-xl border p-4 transition-colors",
        teaserElevationClass,
        "hover:bg-card/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-foreground text-lg font-semibold">{plant.display_name}</h2>
        {plant.planned_action_count > 0 ? (
          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {plant.planned_action_count} planned
          </span>
        ) : null}
      </div>

      {plant.last_action ? (
        <ActionTeaser action={plant.last_action} nested />
      ) : (
        <EmptyActionTeaser signedPhotoUrl={plant.signed_photo_url} alt={plant.display_name} nested />
      )}
    </a>
  );
}
