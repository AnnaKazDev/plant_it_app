import { useCallback, useRef, useState } from "react";
import GardenGrid from "@/components/plants/GardenGrid";
import { formatGridLabel, getGardenGridDimensions, computeCellSize, snapPointerToGridCell } from "@/lib/grid";
import { PlantIcon } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";

interface GardenGridPickerProps {
  gardenWidth: number;
  gardenHeight: number;
  gridX: number;
  gridY: number;
  iconName: string;
  onChange: (gridX: number, gridY: number) => void;
}

export default function GardenGridPicker({
  gardenWidth,
  gardenHeight,
  gridX,
  gridY,
  iconName,
  onChange,
}: GardenGridPickerProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const cellSize = computeCellSize(rows, cols);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const snapPointerToCell = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const cell = snapPointerToGridCell(clientX, clientY, grid, rows, cols, cellSize);
      if (cell) {
        onChange(cell.gridX, cell.gridY);
      }
    },
    [cellSize, cols, onChange, rows],
  );

  function handleKeyDown(event: React.KeyboardEvent) {
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
  }

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

      <GardenGrid
        ref={gridRef}
        gardenWidth={gardenWidth}
        gardenHeight={gardenHeight}
        interactive
        selectedGridX={gridX}
        selectedGridY={gridY}
        onCellSelect={onChange}
        onKeyDown={handleKeyDown}
        gridAriaLabel="Garden grid. Use arrow keys to move the plant marker."
      >
        <div
          ref={gridRef}
          role="button"
          tabIndex={-1}
          aria-label={`Plant marker at ${formatGridLabel(gridX, gridY)}`}
          draggable
          className={cn(
            "bg-primary text-primary-foreground pointer-events-auto absolute z-10 flex cursor-grab items-center justify-center rounded-full shadow-md active:cursor-grabbing",
            isDragging && "ring-ring ring-2",
          )}
          style={{
            width: cellSize - 4,
            height: cellSize - 4,
            left: gridY * cellSize + 2,
            top: gridX * cellSize + 2,
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
          <PlantIcon iconName={iconName} className="size-3.5" />
        </div>
      </GardenGrid>
    </div>
  );
}
