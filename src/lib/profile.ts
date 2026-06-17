import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import type { GardenProfileInput } from "@/lib/profile-schema";

export interface GardenProfileRow {
  location_city: string | null;
  garden_name: string | null;
  garden_width: number | null;
  garden_height: number | null;
}

export function mapGardenProfileToRow(userId: string, data: GardenProfileInput) {
  return {
    id: userId,
    location_city: data.city,
    garden_name: data.garden_name,
    garden_width: data.garden_width,
    garden_height: data.garden_height,
  };
}

export async function upsertGardenProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: GardenProfileInput,
) {
  return supabase.from("profiles").upsert(mapGardenProfileToRow(userId, data), { onConflict: "id" });
}

export function isGardenProfileComplete(
  profile: Pick<GardenProfileRow, "garden_width" | "garden_height"> | null,
): boolean {
  if (!profile) {
    return false;
  }
  return Boolean(profile.garden_width && profile.garden_height);
}

export async function fetchGardenProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<GardenProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("location_city, garden_name, garden_width, garden_height")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
