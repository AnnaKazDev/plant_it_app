import GardenGrid from "@/components/plants/GardenGrid";
import { getActionLabel } from "@/components/plants/ActionTeaser";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatActionDate } from "@/lib/action-dates";
import { computeCellSize, formatGridLabel, getGardenGridDimensions, GRID_DISPLAY_MAP } from "@/lib/grid";
import type { GardenMapPlant } from "@/lib/plant-page";
import { PlantIcon } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

interface GardenMapViewProps {
  gardenWidth: number;
  gardenHeight: number;
  plants: GardenMapPlant[];
}

interface MarkerLayout {
  plant: GardenMapPlant;
  left: number;
  top: number;
  size: number;
  zIndex: number;
}

const CELL_FAN_POSITIONS = [
  { dx: 0.12, dy: 0.12 },
  { dx: 0.52, dy: 0.12 },
  { dx: 0.12, dy: 0.52 },
  { dx: 0.52, dy: 0.52 },
] as const;

function groupPlantsByCell(plants: GardenMapPlant[]): Map<string, GardenMapPlant[]> {
  const groups = new Map<string, GardenMapPlant[]>();

  for (const plant of plants) {
    const key = `${String(plant.grid_x)}-${String(plant.grid_y)}`;
    const cellPlants = groups.get(key) ?? [];
    cellPlants.push(plant);
    groups.set(key, cellPlants);
  }

  return groups;
}

function buildMarkerLayouts(plants: GardenMapPlant[], cellSize: number): MarkerLayout[] {
  const groups = groupPlantsByCell(plants);
  const layouts: MarkerLayout[] = [];

  for (const cellPlants of groups.values()) {
    const count = cellPlants.length;
    const markerSize = count > 4 ? Math.max(12, Math.floor(cellSize * 0.38)) : cellSize - 4;

    cellPlants.forEach((plant, index) => {
      const position = CELL_FAN_POSITIONS[index % CELL_FAN_POSITIONS.length];
      const stackLayer = Math.floor(index / CELL_FAN_POSITIONS.length);

      layouts.push({
        plant,
        left: plant.grid_y * cellSize + position.dx * cellSize + stackLayer * 2,
        top: plant.grid_x * cellSize + position.dy * cellSize + stackLayer * 2,
        size: markerSize,
        zIndex: 10 + index,
      });
    });
  }

  return layouts;
}

function getTooltipPhotoUrl(plant: GardenMapPlant): string | null {
  const actionPhoto = plant.last_action?.photos[0]?.signed_photo_url;
  return actionPhoto ?? plant.signed_photo_url;
}

export default function GardenMapView({ gardenWidth, gardenHeight, plants }: GardenMapViewProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const cellSize = computeCellSize(rows, cols, GRID_DISPLAY_MAP);
  const markers = buildMarkerLayouts(plants, cellSize);

  return (
    <TooltipProvider>
      <GardenGrid variant="map" gardenWidth={gardenWidth} gardenHeight={gardenHeight} gridAriaLabel="Garden map">
        {markers.map(({ plant, left, top, size, zIndex }) => {
          const coordinateLabel = formatGridLabel(plant.grid_x, plant.grid_y);
          const tooltipPhotoUrl = getTooltipPhotoUrl(plant);

          return (
            <Tooltip key={plant.id}>
              <TooltipTrigger asChild>
                <a
                  href={`/plants/${plant.id}`}
                  aria-label={`${plant.display_name} at ${coordinateLabel}`}
                  className={cn(
                    "bg-primary text-primary-foreground absolute flex items-center justify-center rounded-full shadow-md transition-transform hover:scale-105",
                  )}
                  style={{
                    width: size,
                    height: size,
                    left,
                    top,
                    zIndex,
                  }}
                >
                  <PlantIcon
                    iconName={plant.icon_name}
                    className={cn(size <= 20 ? "size-3" : size <= 32 ? "size-4" : "size-5")}
                  />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 p-0">
                <div className="flex gap-2 p-2">
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {tooltipPhotoUrl ? (
                      <img src={tooltipPhotoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff className="text-muted-foreground size-5" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-primary-foreground truncate text-sm font-medium">{plant.display_name}</p>
                    <p className="text-primary-foreground/80 text-xs">{coordinateLabel}</p>
                    {plant.last_action ? (
                      <>
                        <p className="text-primary-foreground/90 text-xs capitalize">
                          {getActionLabel(plant.last_action)}
                        </p>
                        <p className="text-primary-foreground/70 text-xs">{formatActionDate(plant.last_action.date)}</p>
                      </>
                    ) : (
                      <p className="text-primary-foreground/70 text-xs">No actions yet</p>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </GardenGrid>
    </TooltipProvider>
  );
}
