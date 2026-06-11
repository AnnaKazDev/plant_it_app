import { useCallback, useRef, useState } from "react";
import { Sprout } from "lucide-react";
import { formatGridLabel, getGardenGridDimensions } from "@/lib/grid";
import { cn } from "@/lib/utils";

interface GardenGridPickerProps {
  gardenWidth: number;
  gardenHeight: number;
  gridX: number;
  gridY: number;
  onChange: (gridX: number, gridY: number) => void;
}

const MAX_CELL_PX = 28;
const MIN_CELL_PX = 20;

export default function GardenGridPicker({ gardenWidth, gardenHeight, gridX, gridY, onChange }: GardenGridPickerProps) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(320 / Math.max(cols, rows))));

  const snapPointerToCell = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        onChange(row, col);
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
          Drag the marker or click a cell. Selected:{" "}
          <span className="text-foreground font-medium">{formatGridLabel(gridX, gridY)}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {rows}×{cols} m
        </p>
      </div>

      <div className="border-border bg-muted/20 max-h-96 overflow-auto rounded-lg border p-2">
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          aria-label="Garden grid. Use arrow keys to move the plant marker."
          onKeyDown={handleKeyDown}
          className="focus-visible:ring-ring relative inline-block outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${String(cols)}, ${String(cellSize)}px)`,
            gridTemplateRows: `repeat(${String(rows)}, ${String(cellSize)}px)`,
          }}
        >
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => {
              const isSelected = row === gridX && col === gridY;
              return (
                <button
                  key={`${String(row)}-${String(col)}`}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`Cell ${formatGridLabel(row, col)}`}
                  className={cn(
                    "border-border/60 hover:bg-primary/10 border transition-colors",
                    isSelected && "bg-primary/20",
                  )}
                  style={{ width: cellSize, height: cellSize }}
                  onClick={() => {
                    onChange(row, col);
                  }}
                />
              );
            }),
          )}

          <div
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
            <Sprout className="size-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
