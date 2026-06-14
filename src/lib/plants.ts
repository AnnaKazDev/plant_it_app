import type { SupabaseClient } from "@supabase/supabase-js";
import { formatGridLabel } from "@/lib/grid";
import type { Database } from "@/types";

export function formatPlantDisplayName(name: string, gridX: number, gridY: number): string {
  return `${name} (${formatGridLabel(gridX, gridY)})`;
}

export async function getUserPlantCount(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { count } = await supabase.from("plants").select("*", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}
