import type { AstroCookies } from "astro";
import { createClient } from "@/lib/supabase";

export interface AddPlantPageData {
  gardenWidth: number;
  gardenHeight: number;
  gardenName?: string;
  hasGardenSetup: boolean;
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
