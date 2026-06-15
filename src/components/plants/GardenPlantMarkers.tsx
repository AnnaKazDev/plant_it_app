import { getActionLabel, PlantPlaceholderImage } from "@/components/plants/ActionTeaser";
import { useGardenGridCellSize, useGardenGridRows } from "@/components/plants/garden-grid-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatActionDate } from "@/lib/action-dates";
import { buildMarkerLayouts, getMarkerTooltipSide } from "@/lib/garden-markers";
import { formatGridLabel } from "@/lib/grid";
import type { GardenMapPlant } from "@/lib/plant-page";
import { PlantIcon } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";

interface GardenPlantMarkersProps {
  plants: GardenMapPlant[];
  linkable?: boolean;
}

function getTooltipPhotoUrl(plant: GardenMapPlant): string | null {
  return plant.signed_photo_url ?? plant.last_action?.photos[0]?.signed_photo_url ?? null;
}

function markerIconClassName(size: number): string {
  return cn(size <= 20 ? "size-3" : size <= 32 ? "size-4" : "size-5");
}

export default function GardenPlantMarkers({ plants, linkable = true }: GardenPlantMarkersProps) {
  const cellSize = useGardenGridCellSize();
  const rows = useGardenGridRows();
  const markers = buildMarkerLayouts(plants, cellSize);

  return (
    <>
      {markers.map(({ plant, left, top, size, zIndex }) => {
        const coordinateLabel = formatGridLabel(plant.grid_x, plant.grid_y);
        const tooltipSide = getMarkerTooltipSide(plant.grid_x, rows);
        const tooltipPhotoUrl = getTooltipPhotoUrl(plant);
        const markerClassName = cn(
          "bg-primary text-primary-foreground absolute flex items-center justify-center rounded-full shadow-md",
          linkable && "transition-transform hover:scale-105",
        );
        const markerStyle = { width: size, height: size, left, top, zIndex };

        const markerBody = (
          <>
            <PlantIcon iconName={plant.icon_name} className={markerIconClassName(size)} />
          </>
        );

        return (
          <Tooltip key={plant.id}>
            <TooltipTrigger asChild>
              {linkable ? (
                <a
                  href={`/plants/${plant.id}`}
                  aria-label={`${plant.display_name} at ${coordinateLabel}`}
                  className={markerClassName}
                  style={markerStyle}
                >
                  {markerBody}
                </a>
              ) : (
                <span
                  aria-label={`${plant.display_name} at ${coordinateLabel}`}
                  className={cn(markerClassName, "pointer-events-auto")}
                  style={markerStyle}
                >
                  {markerBody}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent
              side={tooltipSide}
              sideOffset={10}
              collisionPadding={24}
              className="max-w-[36rem] p-0 text-base"
            >
              <div className="flex gap-6 p-6">
                <div className="bg-muted flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                  {tooltipPhotoUrl ? (
                    <img src={tooltipPhotoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <PlantPlaceholderImage alt={plant.display_name} />
                  )}
                </div>
                <div className="min-w-0 space-y-2 py-1">
                  <p className="text-primary-foreground text-xl leading-snug font-semibold">{plant.display_name}</p>
                  {plant.last_action ? (
                    <>
                      <p className="text-primary-foreground/90 text-base capitalize">
                        {getActionLabel(plant.last_action)}
                      </p>
                      <p className="text-primary-foreground/75 text-base">{formatActionDate(plant.last_action.date)}</p>
                    </>
                  ) : (
                    <p className="text-primary-foreground/75 text-base">No actions yet</p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
