export const CELL_FAN_POSITIONS = [
  { dx: 0.12, dy: 0.12 },
  { dx: 0.52, dy: 0.12 },
  { dx: 0.12, dy: 0.52 },
  { dx: 0.52, dy: 0.52 },
] as const;

export interface GridPositionedPlant {
  id: string;
  grid_x: number;
  grid_y: number;
}

export interface PlantMarkerLayout {
  left: number;
  top: number;
  size: number;
  zIndex: number;
}

export interface PlantMarkerLayoutEntry<T extends GridPositionedPlant> extends PlantMarkerLayout {
  plant: T;
}

function markerSizeForCellCount(count: number, cellSize: number): number {
  return count > 4 ? Math.max(12, Math.floor(cellSize * 0.38)) : cellSize - 4;
}

function layoutAtCellIndex(
  gridX: number,
  gridY: number,
  indexInCell: number,
  cellSize: number,
  countInCell: number,
): PlantMarkerLayout {
  const markerSize = markerSizeForCellCount(countInCell, cellSize);
  const position = CELL_FAN_POSITIONS[indexInCell % CELL_FAN_POSITIONS.length];
  const stackLayer = Math.floor(indexInCell / CELL_FAN_POSITIONS.length);

  return {
    left: gridY * cellSize + position.dx * cellSize + stackLayer * 2,
    top: gridX * cellSize + position.dy * cellSize + stackLayer * 2,
    size: markerSize,
    zIndex: 10 + indexInCell,
  };
}

export function groupPlantsByCell<T extends GridPositionedPlant>(plants: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const plant of plants) {
    const key = `${String(plant.grid_x)}-${String(plant.grid_y)}`;
    const cellPlants = groups.get(key) ?? [];
    cellPlants.push(plant);
    groups.set(key, cellPlants);
  }

  return groups;
}

export function buildMarkerLayouts<T extends GridPositionedPlant>(
  plants: T[],
  cellSize: number,
): PlantMarkerLayoutEntry<T>[] {
  const groups = groupPlantsByCell(plants);
  const layouts: PlantMarkerLayoutEntry<T>[] = [];

  for (const cellPlants of groups.values()) {
    const count = cellPlants.length;

    cellPlants.forEach((plant, index) => {
      layouts.push({
        plant,
        ...layoutAtCellIndex(plant.grid_x, plant.grid_y, index, cellSize, count),
      });
    });
  }

  return layouts;
}

export function getNewPlantMarkerLayout(
  gridX: number,
  gridY: number,
  existingPlantCountAtCell: number,
  cellSize: number,
): PlantMarkerLayout {
  const totalInCell = existingPlantCountAtCell + 1;

  return {
    ...layoutAtCellIndex(gridX, gridY, existingPlantCountAtCell, cellSize, totalInCell),
    zIndex: 40,
  };
}

export function countPlantsAtCell(plants: GridPositionedPlant[], gridX: number, gridY: number): number {
  return plants.filter((plant) => plant.grid_x === gridX && plant.grid_y === gridY).length;
}
