function rowIndexToLabel(gridX: number): string {
  let label = "";
  let index = gridX;

  while (index >= 0) {
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26) - 1;
  }

  return label;
}

function parseRowLabel(rowPart: string): number | null {
  const upper = rowPart.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) {
    return null;
  }

  let gridX = 0;
  for (const char of upper) {
    gridX = gridX * 26 + (char.charCodeAt(0) - 64);
  }

  return gridX - 1;
}

export function formatGridLabel(gridX: number, gridY: number): string {
  return `${rowIndexToLabel(gridX)}${String(gridY + 1)}`;
}

export function parseGridLabel(label: string): { grid_x: number; grid_y: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(label.trim());
  if (!match) {
    return null;
  }

  const colNumber = Number.parseInt(match[2], 10);
  if (colNumber < 1) {
    return null;
  }

  const gridX = parseRowLabel(match[1]);
  if (gridX === null || gridX < 0) {
    return null;
  }

  return { grid_x: gridX, grid_y: colNumber - 1 };
}

export function getGardenGridDimensions(gardenWidth: number, gardenHeight: number): { rows: number; cols: number } {
  return {
    cols: Math.max(1, Math.floor(gardenWidth)),
    rows: Math.max(1, Math.floor(gardenHeight)),
  };
}

export function isWithinGardenBounds(gridX: number, gridY: number, gardenWidth: number, gardenHeight: number): boolean {
  const { rows, cols } = getGardenGridDimensions(gardenWidth, gardenHeight);
  return gridX >= 0 && gridX < rows && gridY >= 0 && gridY < cols;
}

export const MIN_CELL_PX = 20;
export const MAX_CELL_PX = 28;
export const DEFAULT_GRID_VIEWPORT_PX = 320;

export function computeCellSize(rows: number, cols: number, maxViewportPx: number = DEFAULT_GRID_VIEWPORT_PX): number {
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(maxViewportPx / Math.max(cols, rows))));
}

export function formatRowLabel(gridX: number): string {
  return formatGridLabel(gridX, 0).replace(/\d+$/, "");
}

export function snapPointerToGridCell(
  clientX: number,
  clientY: number,
  gridElement: HTMLElement,
  rows: number,
  cols: number,
  cellSize: number,
): { gridX: number; gridY: number } | null {
  const rect = gridElement.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const gridY = Math.floor(x / cellSize);
  const gridX = Math.floor(y / cellSize);

  if (gridX >= 0 && gridX < rows && gridY >= 0 && gridY < cols) {
    return { gridX, gridY };
  }

  return null;
}
