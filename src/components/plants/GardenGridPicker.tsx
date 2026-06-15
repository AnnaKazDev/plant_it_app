import { useCallback, useRef, useState } from "react";
import GardenGrid from "@/components/plants/GardenGrid";
import GardenPlantMarkers from "@/components/plants/GardenPlantMarkers";
import { useGardenGridCellSize } from "@/components/plants/garden-grid-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { countPlantsAtCell, getNewPlantMarkerLayout } from "@/lib/garden-markers";
import { formatGridLabel, getGardenGridDimensions, snapPointerToGridCell } from "@/lib/grid";
import type { GardenMapPlant } from "@/lib/plant-page";
import { PlantIcon } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";

interface GardenGridPickerProps {
  gardenWidth: number;
  gardenHeight: number;
  gridX: number;
  gridY: number;
  iconName: string;
  existingPlants: GardenMapPlant[];
  onChange: (gridX: number, gridY: number) => void;
}

interface NewPlantPickerMarkerProps {
  gridX: number;
  gridY: number;
  iconName: string;
  existingPlants: GardenMapPlant[];
  gridRef: React.RefObject<HTMLDivElement | null>;
  rows: number;
  cols: number;
  onChange: (gridX: number, gridY: number) => void;
}

function NewPlantPickerMarker({
  gridX,
  gridY,
  iconName,
  existingPlants,
  gridRef,
  rows,
  cols,
  onChange,
}: NewPlantPickerMarkerProps) {
  const cellSize = useGardenGridCellSize();
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const existingAtCell = countPlantsAtCell(existingPlants, gridX, gridY);
  const newPlantLayout = getNewPlantMarkerLayout(gridX, gridY, existingAtCell, cellSize);

  const snapPointerToCell = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const cell = snapPointerToGridCell(clientX, clientY, grid, rows, cols, cellSize);
      if (cell) {
        onChange(cell.gridX, cell.gridY);
      }
    },
    [cellSize, cols, gridRef, onChange, rows],
  );

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={`New plant at ${formatGridLabel(gridX, gridY)}`}
      draggable
      className={cn(
        "pointer-events-auto absolute flex cursor-grab items-center justify-center rounded-full bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-300 active:cursor-grabbing",
        !isDragging && "motion-safe:animate-[new-plant-pulse_2.5s_ease-in-out_infinite]",
        isDragging && "ring-ring ring-offset-1 motion-reduce:animate-none",
      )}
      style={{
        width: newPlantLayout.size,
        height: newPlantLayout.size,
        left: newPlantLayout.left,
        top: newPlantLayout.top,
        zIndex: newPlantLayout.zIndex,
      }}
      onDragStart={() => {
        isDraggingRef.current = true;
        setIsDragging(true);
      }}
      onDragEnd={() => {
        isDraggingRef.current = false;
        setIsDragging(false);
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        isDraggingRef.current = true;
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (!isDraggingRef.current) return;
        snapPointerToCell(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        isDraggingRef.current = false;
        setIsDragging(false);
        snapPointerToCell(event.clientX, event.clientY);
      }}
    >
      <PlantIcon
        iconName={iconName}
        className={cn(newPlantLayout.size <= 20 ? "size-3" : newPlantLayout.size <= 32 ? "size-4" : "size-5")}
      />
    </div>
  );
}

export default function GardenGridPicker({
  gardenWidth,
  gardenHeight,
  gridX,
  gridY,
  iconName,
  existingPlants,
  onChange,
}: GardenGridPickerProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Drag the marker or click the grid. Selected:{" "}
          <span className="text-foreground font-medium">{formatGridLabel(gridX, gridY)}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {rows}×{cols} m
        </p>
      </div>

      <TooltipProvider>
        <GardenGrid
          ref={gridRef}
          variant="map"
          gardenWidth={gardenWidth}
          gardenHeight={gardenHeight}
          interactive
          selectedGridX={gridX}
          selectedGridY={gridY}
          onCellSelect={onChange}
          onKeyDown={(event) => {
            let nextX = gridX;
            let nextY = gridY;

            switch (event.key) {
              case "ArrowUp":
                nextX = Math.max(0, gridX - 1);
                break;
              case "ArrowDown":
                nextX = Math.min(rows - 1, gridX + 1);
                break;
              case "ArrowLeft":
                nextY = Math.max(0, gridY - 1);
                break;
              case "ArrowRight":
                nextY = Math.min(cols - 1, gridY + 1);
                break;
              default:
                return;
            }

            event.preventDefault();
            onChange(nextX, nextY);
          }}
          gridAriaLabel="Garden grid. Use arrow keys to move the plant marker."
        >
          <GardenPlantMarkers plants={existingPlants} linkable={false} />
          <NewPlantPickerMarker
            gridX={gridX}
            gridY={gridY}
            iconName={iconName}
            existingPlants={existingPlants}
            gridRef={gridRef}
            rows={rows}
            cols={cols}
            onChange={onChange}
          />
        </GardenGrid>
      </TooltipProvider>

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-full bg-amber-500 ring-2 ring-amber-300 motion-safe:animate-[new-plant-pulse_2.5s_ease-in-out_infinite]"
            aria-hidden
          />
          New plant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary size-3 rounded-full" aria-hidden />
          Existing plants
        </span>
      </p>
    </div>
  );
}
