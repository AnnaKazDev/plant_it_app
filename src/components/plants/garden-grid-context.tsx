import { createContext, useContext } from "react";

interface GardenGridContextValue {
  cellSize: number;
  rows: number;
}

const GardenGridContext = createContext<GardenGridContextValue | null>(null);

export function GardenGridCellSizeProvider({
  cellSize,
  rows,
  children,
}: {
  cellSize: number;
  rows: number;
  children: React.ReactNode;
}) {
  return <GardenGridContext.Provider value={{ cellSize, rows }}>{children}</GardenGridContext.Provider>;
}

function useGardenGridContext(): GardenGridContextValue {
  const value = useContext(GardenGridContext);
  if (value === null) {
    throw new Error("useGardenGridCellSize must be used within GardenGrid");
  }

  return value;
}

export function useGardenGridCellSize(): number {
  return useGardenGridContext().cellSize;
}

export function useGardenGridRows(): number {
  return useGardenGridContext().rows;
}
