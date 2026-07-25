/**
 * E2E plant helpers — seed plants via Supabase admin API.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import { formatPlantDisplayName } from "@/lib/plants";
import { config } from "dotenv";
import path from "path";
import ws from "ws";

config({ path: path.resolve(process.cwd(), ".env") });

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export interface E2ePlant {
  plantId: string;
  name: string;
  displayName: string;
  gridX: number;
  gridY: number;
}

function adminClient() {
  return createClient<Database>(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      transport: ws as any,
    },
  });
}

export async function createE2ePlant(userId: string, label = "e2e-plant"): Promise<E2ePlant> {
  const admin = adminClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const name = `${label}-${suffix}`;
  const gridX = Math.floor(Math.random() * 5);
  const gridY = Math.floor(Math.random() * 4);

  const { data, error } = await admin
    .from("plants")
    .insert({
      user_id: userId,
      name,
      grid_x: gridX,
      grid_y: gridY,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create E2E plant: ${error.message}`);
  }

  const plantId = data.id;

  return {
    plantId,
    name,
    displayName: formatPlantDisplayName(name, gridX, gridY),
    gridX,
    gridY,
  };
}
