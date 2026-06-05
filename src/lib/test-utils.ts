/**
 * Test utilities for integration tests
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import ws from "ws";

/**
 * Create a Supabase client for testing
 * Uses environment variables from .env
 * Configures WebSocket transport for Node.js < 22
 * 
 * @param useServiceRole - If true, uses service role key for admin operations
 */
export function createTestClient(useServiceRole: boolean = false) {
  const supabaseUrl = process.env.SUPABASE_URL;
  // Use service role key for admin operations, anon key otherwise
  const supabaseKey = useServiceRole 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY 
    : process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing SUPABASE_URL or ${useServiceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_KEY'} in environment`);
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    realtime: {
      transport: ws as any,
    },
  });
}


/**
 * Create test user and seed data for photo upload tests
 * Returns user auth session, plant ID, action ID, and auth cookies
 */
export async function seedTestData() {
  const supabase = createTestClient();
  const apiUrl = process.env.API_URL || "http://localhost:4321";

  // Create test user
  const email = `test-${Date.now()}@example.com`;
  const password = "testpass123";

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !authData.user || !authData.session) {
    throw new Error(`Failed to create test user: ${signUpError?.message}`);
  }

  const userId = authData.user.id;

  // Get first action type
  const { data: actionType } = await supabase.from("action_types").select("id").limit(1).single();

  if (!actionType) {
    throw new Error("No action types found. Run migrations first.");
  }

  // Create test plant
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .insert({
      user_id: userId,
      name: "Test Monstera",
      grid_x: 0,
      grid_y: 0,
    })
    .select("id")
    .single();

  if (plantError || !plant) {
    throw new Error(`Failed to create test plant: ${plantError?.message}`);
  }

  // Create test action
  const { data: action, error: actionError } = await supabase
    .from("actions")
    .insert({
      plant_id: plant.id,
      action_type_id: actionType.id,
      date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
    })
    .select("id")
    .single();

  if (actionError || !action) {
    throw new Error(`Failed to create test action: ${actionError?.message}`);
  }

  return {
    userId,
    plantId: plant.id,
    actionId: action.id,
    email,
    password,
  };
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(userId: string) {
  const supabase = createTestClient(true); // Use service role for cleanup

  // Delete user's plants (cascade deletes actions and photos)
  await supabase.from("plants").delete().eq("user_id", userId);
  
  // Delete user from auth (requires service role)
  await supabase.auth.admin.deleteUser(userId);
}

/**
 * Create a test file (image) for upload testing
 */
export function createTestFile(
  name: string = "test.jpg",
  type: string = "image/jpeg",
  size: number = 1024,
): File {
  // Create a small test buffer
  const buffer = new Uint8Array(size);
  // Fill with some data
  for (let i = 0; i < size; i++) {
    buffer[i] = i % 256;
  }

  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type });
}

/**
 * Create FormData for photo upload
 */
export function createUploadFormData(actionId: string, file: File): FormData {
  const formData = new FormData();
  formData.append("action_id", actionId);
  formData.append("file", file);
  return formData;
}
