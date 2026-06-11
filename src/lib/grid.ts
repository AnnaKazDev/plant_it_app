export function formatGridLabel(gridX: number, gridY: number): string {
  return `${String.fromCharCode(65 + gridX)}${String(gridY + 1)}`;
}

export function parseGridLabel(label: string): { grid_x: number; grid_y: number } | null {
  const match = /^([A-Za-z])(\d+)$/.exec(label.trim());
  if (!match) {
    return null;
  }

  const rowChar = match[1].toUpperCase();
  const colNumber = Number.parseInt(match[2], 10);

  if (colNumber < 1) {
    return null;
  }

  const gridX = rowChar.charCodeAt(0) - 65;
  if (gridX < 0) {
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
