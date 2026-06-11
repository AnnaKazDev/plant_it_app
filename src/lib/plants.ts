import { formatGridLabel } from "@/lib/grid";

export function formatPlantDisplayName(name: string, gridX: number, gridY: number): string {
  return `${name} (${formatGridLabel(gridX, gridY)})`;
}
