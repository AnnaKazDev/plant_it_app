import {
  compareActionsByDateAsc,
  compareActionsByDateDesc,
  formatActionDate,
  isPlannedAction,
} from "@/lib/action-dates";
import { formatGridLabel } from "@/lib/grid";
import type { PlantCardAction, PlantCardPlant } from "@/lib/plant-page";
import type { WeatherData } from "@/types";

interface ApiPlantDetail {
  id: string;
  display_name: string;
  grid_x: number;
  grid_y: number;
  signed_photo_url: string | null;
  created_at: string;
  actions: {
    id: string;
    date: string;
    custom_action_name: string | null;
    additional_data: string | null;
    weather_data: WeatherData | null;
    action_type: { name: string; icon_emoji: string } | null;
    photos: { id: string; order_index: number; signed_photo_url: string }[];
  }[];
}

export function mapApiPlantToCard(plant: ApiPlantDetail): PlantCardPlant {
  const actions: PlantCardAction[] = [...plant.actions].sort(compareActionsByDateDesc).map((action) => ({
    id: action.id,
    date: action.date,
    custom_action_name: action.custom_action_name,
    additional_data: action.additional_data,
    action_type: action.action_type,
    weather_data: action.weather_data,
    photos: [...action.photos]
      .sort((a, b) => a.order_index - b.order_index)
      .map((photo) => ({
        id: photo.id,
        order_index: photo.order_index,
        signed_photo_url: photo.signed_photo_url,
      })),
  }));

  return {
    id: plant.id,
    display_name: plant.display_name,
    signed_photo_url: plant.signed_photo_url,
    grid_x: plant.grid_x,
    grid_y: plant.grid_y,
    grid_label: formatGridLabel(plant.grid_x, plant.grid_y),
    created_at: plant.created_at,
    planned_action_count: actions.filter((action) => isPlannedAction(action.date)).length,
    actions,
  };
}

export async function fetchPlantCardClient(plantId: string): Promise<PlantCardPlant> {
  const response = await fetch(`/api/plants/${plantId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch plant");
  }

  const data = (await response.json()) as { plant: ApiPlantDetail };
  return mapApiPlantToCard(data.plant);
}

export function partitionActionsByPlanned(actions: PlantCardAction[]) {
  return {
    planned: actions.filter((action) => isPlannedAction(action.date)).sort(compareActionsByDateAsc),
    history: actions.filter((action) => !isPlannedAction(action.date)).sort(compareActionsByDateDesc),
  };
}

export function formatPlantSinceDate(isoDate: string): string {
  return formatActionDate(isoDate);
}
