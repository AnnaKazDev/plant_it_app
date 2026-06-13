import type { AstroCookies } from "astro";
import { compareActionsByDateDesc, isPlannedAction } from "@/lib/action-dates";
import { formatPlantDisplayName } from "@/lib/plants";
import { createClient } from "@/lib/supabase";
import { extractStoragePathFromPublicUrl, getSignedPhotoUrl } from "@/lib/storage";
import type { WeatherData } from "@/types";

export interface AddPlantPageData {
  gardenWidth: number;
  gardenHeight: number;
  gardenName?: string;
  hasGardenSetup: boolean;
}

export interface PlantCardActionPhoto {
  id: string;
  signed_photo_url: string;
  order_index: number;
}

export interface PlantCardAction {
  id: string;
  date: string;
  custom_action_name: string | null;
  additional_data: string | null;
  action_type: { name: string; icon_emoji: string } | null;
  weather_data: WeatherData | null;
  photos: PlantCardActionPhoto[];
}

export interface PlantCardPageData {
  found: boolean;
  plant?: {
    id: string;
    display_name: string;
    signed_photo_url: string | null;
    actions: PlantCardAction[];
  };
}

export interface PlantListItem {
  id: string;
  display_name: string;
  signed_photo_url: string | null;
  last_action: PlantCardAction | null;
  planned_action_count: number;
}

export interface PlantListPageData {
  plants: PlantListItem[];
}

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

interface RawActionRow {
  id: string;
  plant_id: string;
  custom_action_name: string | null;
  additional_data: string | null;
  date: string;
  weather_data: unknown;
  photos: { id: string; photo_url: string; order_index: number }[];
  action_types: { name: string; icon_emoji: string } | null;
}

async function signPhotoUrl(supabase: SupabaseClient, photoUrl: string): Promise<string> {
  const storagePath = extractStoragePathFromPublicUrl(photoUrl);
  if (!storagePath) {
    return photoUrl;
  }

  const signedUrl = await getSignedPhotoUrl(supabase, storagePath);
  return signedUrl ?? photoUrl;
}

async function mapLastActionToCardAction(supabase: SupabaseClient, action: RawActionRow): Promise<PlantCardAction> {
  const sortedPhotos = [...action.photos].sort((a, b) => a.order_index - b.order_index);
  let photos: PlantCardActionPhoto[] = [];

  if (sortedPhotos.length > 0) {
    const firstPhoto = sortedPhotos[0];
    photos = [
      {
        id: firstPhoto.id,
        order_index: firstPhoto.order_index,
        signed_photo_url: await signPhotoUrl(supabase, firstPhoto.photo_url),
      },
    ];
  }

  return {
    id: action.id,
    date: action.date,
    custom_action_name: action.custom_action_name,
    additional_data: action.additional_data,
    action_type: action.action_types,
    weather_data: action.weather_data as WeatherData | null,
    photos,
  };
}

export async function fetchPlantListForUser(supabase: SupabaseClient, userId: string): Promise<PlantListItem[]> {
  const { data: plants, error: plantsError } = await supabase
    .from("plants")
    .select("id, name, photo_url, grid_x, grid_y, created_at")
    .eq("user_id", userId);

  if (plantsError || plants.length === 0) {
    return [];
  }

  const plantIds = plants.map((plant) => plant.id);

  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select(
      `
      id,
      plant_id,
      custom_action_name,
      additional_data,
      date,
      weather_data,
      photos (
        id,
        photo_url,
        order_index
      ),
      action_types (
        name,
        icon_emoji
      )
    `,
    )
    .in("plant_id", plantIds);

  if (actionsError) {
    return [];
  }

  const actionsByPlantId = new Map<string, RawActionRow[]>();
  for (const action of actions) {
    const plantActions = actionsByPlantId.get(action.plant_id) ?? [];
    plantActions.push(action);
    actionsByPlantId.set(action.plant_id, plantActions);
  }

  const listItems = await Promise.all(
    plants.map(async (plant) => {
      const plantActions = (actionsByPlantId.get(plant.id) ?? []).sort(compareActionsByDateDesc);
      const plannedActionCount = plantActions.filter((action) => isPlannedAction(action.date)).length;

      const signedPhotoUrl = plant.photo_url ? await signPhotoUrl(supabase, plant.photo_url) : null;
      const lastAction = plantActions.length > 0 ? await mapLastActionToCardAction(supabase, plantActions[0]) : null;

      return {
        id: plant.id,
        display_name: formatPlantDisplayName(plant.name, plant.grid_x, plant.grid_y),
        signed_photo_url: signedPhotoUrl,
        last_action: lastAction,
        planned_action_count: plannedActionCount,
        activityDate: lastAction?.date ?? plant.created_at ?? "",
      };
    }),
  );

  return listItems
    .sort((a, b) => new Date(b.activityDate || 0).getTime() - new Date(a.activityDate || 0).getTime())
    .map(({ activityDate: _activityDate, ...item }) => item);
}

export async function loadPlantListPageData(
  requestHeaders: Headers,
  cookies: AstroCookies,
  userId: string,
): Promise<PlantListPageData> {
  const supabase = createClient(requestHeaders, cookies);

  if (!supabase) {
    return { plants: [] };
  }

  const plants = await fetchPlantListForUser(supabase, userId);
  return { plants };
}

export async function loadAddPlantPageData(
  requestHeaders: Headers,
  cookies: AstroCookies,
  userId: string,
): Promise<AddPlantPageData> {
  const supabase = createClient(requestHeaders, cookies);

  if (!supabase) {
    return { gardenWidth: 0, gardenHeight: 0, hasGardenSetup: false };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("garden_width, garden_height, garden_name")
    .eq("id", userId)
    .single();

  if (error) {
    return { gardenWidth: 0, gardenHeight: 0, hasGardenSetup: false };
  }

  if (!profile.garden_width || !profile.garden_height) {
    return { gardenWidth: 0, gardenHeight: 0, hasGardenSetup: false };
  }

  return {
    gardenWidth: profile.garden_width,
    gardenHeight: profile.garden_height,
    gardenName: profile.garden_name ?? undefined,
    hasGardenSetup: true,
  };
}

export async function loadPlantCardPageData(
  requestHeaders: Headers,
  cookies: AstroCookies,
  plantId: string,
): Promise<PlantCardPageData> {
  const supabase = createClient(requestHeaders, cookies);

  if (!supabase) {
    return { found: false };
  }

  const { data: plant, error } = await supabase
    .from("plants")
    .select(
      `
      id,
      name,
      photo_url,
      grid_x,
      grid_y,
      actions (
        id,
        action_type_id,
        custom_action_name,
        additional_data,
        date,
        weather_data,
        photos (
          id,
          photo_url,
          order_index
        ),
        action_types (
          name,
          icon_emoji
        )
      )
    `,
    )
    .eq("id", plantId)
    .single();

  if (error) {
    return { found: false };
  }

  const signedPlantPhotoUrl = plant.photo_url ? await signPhotoUrl(supabase, plant.photo_url) : null;

  const actions: PlantCardAction[] = await Promise.all(
    plant.actions.sort(compareActionsByDateDesc).map(async (action) => {
      const photos = await Promise.all(
        action.photos
          .sort((a, b) => a.order_index - b.order_index)
          .map(async (photo) => ({
            id: photo.id,
            order_index: photo.order_index,
            signed_photo_url: await signPhotoUrl(supabase, photo.photo_url),
          })),
      );

      return {
        id: action.id,
        date: action.date,
        custom_action_name: action.custom_action_name,
        additional_data: action.additional_data,
        action_type: action.action_types,
        weather_data: action.weather_data as WeatherData | null,
        photos,
      };
    }),
  );

  return {
    found: true,
    plant: {
      id: plant.id,
      display_name: formatPlantDisplayName(plant.name, plant.grid_x, plant.grid_y),
      signed_photo_url: signedPlantPhotoUrl,
      actions,
    },
  };
}
