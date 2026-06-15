import { createContext, useContext } from "react";

const GardenGridCellSizeContext = createContext<number | null>(null);

export function GardenGridCellSizeProvider({ cellSize, children }: { cellSize: number; children: React.ReactNode }) {
  return <GardenGridCellSizeContext.Provider value={cellSize}>{children}</GardenGridCellSizeContext.Provider>;
}

export function useGardenGridCellSize(): number {
  const cellSize = useContext(GardenGridCellSizeContext);
  if (cellSize === null) {
    throw new Error("useGardenGridCellSize must be used within GardenGrid");
  }

  return cellSize;
}
