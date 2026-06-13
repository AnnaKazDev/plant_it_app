import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GardenGridCellSizeProvider } from "@/components/plants/garden-grid-context";
import {
  computeCellSize,
  computeMapCellSizeFromContainer,
  formatRowLabel,
  GARDEN_GRID_MAP_LABEL_WIDTH_PX,
  getGardenGridDimensions,
  GRID_DISPLAY_MAP,
  GRID_DISPLAY_PICKER,
  snapPointerToGridCell,
} from "@/lib/grid";
import { cn } from "@/lib/utils";

const ROW_LABEL_WIDTH_PX = 24;

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

function useGardenGridCellSizeState(
  variant: "picker" | "map",
  rows: number,
  cols: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
): number {
  const pickerCellSize = useMemo(() => computeCellSize(rows, cols, GRID_DISPLAY_PICKER), [rows, cols]);
  const [mapCellSize, setMapCellSize] = useState(() => computeCellSize(rows, cols, GRID_DISPLAY_MAP));

  useEffect(() => {
    if (variant !== "map") return;

    const node = containerRef.current;
    if (!node) return;

    const updateCellSize = () => {
      setMapCellSize(computeMapCellSizeFromContainer(rows, cols, node.clientWidth));
    };

    updateCellSize();

    const observer = new ResizeObserver(updateCellSize);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [variant, rows, cols, containerRef]);

  return variant === "map" ? mapCellSize : pickerCellSize;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const cellSize = useGardenGridCellSizeState(variant, rows, cols, containerRef);
  const rowLabelWidth = variant === "map" ? GARDEN_GRID_MAP_LABEL_WIDTH_PX : ROW_LABEL_WIDTH_PX;
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
      ref={containerRef}
      className={cn(
        "border-border bg-muted/20 rounded-lg border p-2",
        variant === "map" ? "w-full overflow-x-auto overflow-y-visible" : "max-h-96 overflow-auto",
      )}
    >
      <div className={cn("flex flex-col gap-1", variant === "map" ? "w-full min-w-fit" : "inline-flex")}>
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

          <GardenGridCellSizeProvider cellSize={cellSize}>
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
          </GardenGridCellSizeProvider>
        </div>
      </div>
    </div>
  );
});

export default GardenGrid;
