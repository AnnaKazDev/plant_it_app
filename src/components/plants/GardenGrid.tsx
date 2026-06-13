import { forwardRef, useCallback, useRef, type ReactNode } from "react";
import {
  computeCellSize,
  formatRowLabel,
  getGardenGridDimensions,
  GRID_DISPLAY_MAP,
  GRID_DISPLAY_PICKER,
  snapPointerToGridCell,
} from "@/lib/grid";
import { cn } from "@/lib/utils";

const ROW_LABEL_WIDTH_PX = 24;
const ROW_LABEL_WIDTH_MAP_PX = 28;

interface GardenGridProps {
  gardenWidth: number;
  gardenHeight: number;
  children?: ReactNode;
  onCellSelect?: (gridX: number, gridY: number) => void;
  interactive?: boolean;
  selectedGridX?: number;
  selectedGridY?: number;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  gridAriaLabel?: string;
  variant?: "picker" | "map";
}

const GardenGrid = forwardRef<HTMLDivElement, GardenGridProps>(function GardenGrid(
  {
    gardenWidth,
    gardenHeight,
    children,
    onCellSelect,
    interactive = false,
    selectedGridX,
    selectedGridY,
    onKeyDown,
    gridAriaLabel = "Garden grid",
    variant = "picker",
  },
  forwardedRef,
) {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  const preset = variant === "map" ? GRID_DISPLAY_MAP : GRID_DISPLAY_PICKER;
  const cellSize = computeCellSize(rows, cols, preset);
  const rowLabelWidth = variant === "map" ? ROW_LABEL_WIDTH_MAP_PX : ROW_LABEL_WIDTH_PX;
  const labelClassName = variant === "map" ? "text-xs" : "text-[10px]";
  const internalRef = useRef<HTMLDivElement>(null);

  const setGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const handlePointerSelect = useCallback(
    (clientX: number, clientY: number) => {
      const grid = internalRef.current;
      if (!grid || !onCellSelect) return;

      const cell = snapPointerToGridCell(clientX, clientY, grid, rows, cols, cellSize);
      if (cell) {
        onCellSelect(cell.gridX, cell.gridY);
      }
    },
    [cellSize, cols, onCellSelect, rows],
  );

  const colLabels = Array.from({ length: cols }, (_, index) => index + 1);
  const rowLabels = Array.from({ length: rows }, (_, index) => formatRowLabel(index));

  return (
    <div
      className={cn(
        "border-border bg-muted/20 rounded-lg border p-2",
        variant === "map" ? "overflow-x-auto overflow-y-visible" : "max-h-96 overflow-auto",
      )}
    >
      <div className="inline-flex flex-col gap-1">
        <div className="flex items-end" style={{ paddingLeft: rowLabelWidth }}>
          {colLabels.map((label) => (
            <span
              key={label}
              className={cn("text-muted-foreground text-center font-medium", labelClassName)}
              style={{ width: cellSize }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          <div className="flex flex-col" style={{ width: rowLabelWidth }}>
            {rowLabels.map((label) => (
              <span
                key={label}
                className={cn("text-muted-foreground flex items-center justify-end pr-1 font-medium", labelClassName)}
                style={{ height: cellSize }}
              >
                {label}
              </span>
            ))}
          </div>

          <div
            ref={setGridRef}
            role="grid"
            tabIndex={interactive ? 0 : undefined}
            aria-label={gridAriaLabel}
            onKeyDown={interactive ? onKeyDown : undefined}
            onClick={
              interactive
                ? (event) => {
                    handlePointerSelect(event.clientX, event.clientY);
                  }
                : undefined
            }
            className={cn(
              "border-border/80 relative rounded-sm border bg-[#8b7355]/15",
              interactive &&
                "focus-visible:ring-ring cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            )}
            style={{
              width: cols * cellSize,
              height: rows * cellSize,
              backgroundImage: `
                linear-gradient(to right, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px),
                linear-gradient(to bottom, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)
              `,
              backgroundSize: `${String(cellSize)}px ${String(cellSize)}px`,
            }}
          >
            {interactive && selectedGridX !== undefined && selectedGridY !== undefined ? (
              <div
                className="bg-primary/15 pointer-events-none absolute z-0"
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: selectedGridY * cellSize,
                  top: selectedGridX * cellSize,
                }}
                aria-hidden="true"
              />
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GardenGrid;
