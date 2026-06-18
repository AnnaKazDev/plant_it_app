/**
 * Test utilities for integration tests
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

export interface TestUserFixture {
  userId: string;
  plantId: string;
  actionId: string;
  actionTypeId: string;
  gardenWidth: number;
  gardenHeight: number;
  email: string;
  password: string;
}

/**
 * Create a Supabase client for testing
 * Uses environment variables from .env
 * Configures WebSocket transport for Node.js < 22
 *
 * @param useServiceRole - If true, uses service role key for admin operations
 */
export function createTestClient(useServiceRole = false) {
  const supabaseUrl = process.env.SUPABASE_URL;
  // Use service role key for admin operations, anon key otherwise
  const supabaseKey = useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Missing SUPABASE_URL or ${useServiceRole ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_KEY"} in environment`,
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      transport: ws as any,
    },
  });
}

/**
 * Sign in a test user and return headers suitable for fetch (Bearer JWT, RLS active).
 */
export async function signInTestUser(email: string, password: string): Promise<Record<string, string>> {
  const client = createTestClient(false);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  const accessToken = data.session.access_token;
  if (!accessToken) {
    throw new Error("Failed to sign in test user: no session");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Build integration test headers: JWT session + X-Test-User-Id (middleware) + Origin (CSRF).
 */
export async function buildTestAuthHeaders(
  user: Pick<TestUserFixture, "userId" | "email" | "password">,
  apiUrl: string,
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const sessionHeaders = await signInTestUser(user.email, user.password);
  return {
    ...sessionHeaders,
    "X-Test-User-Id": user.userId,
    Origin: apiUrl,
    ...extra,
  };
}

/**
 * Admin row counts for rejection read-back oracles.
 */
export async function getRowCounts(
  admin: SupabaseClient<Database>,
  filters: { plantId?: string; actionId?: string } = {},
): Promise<{ actions: number; photos: number }> {
  let actions = 0;
  let photos = 0;

  if (filters.plantId) {
    const { count, error } = await admin
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("plant_id", filters.plantId);

    if (error) {
      throw new Error(`Failed to count actions: ${error.message}`);
    }

    actions = count ?? 0;
  }

  if (filters.actionId) {
    const { count, error } = await admin
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("action_id", filters.actionId);

    if (error) {
      throw new Error(`Failed to count photos: ${error.message}`);
    }

    photos = count ?? 0;
  }

  return { actions, photos };
}

async function seedUserFixture(label: string, gridX: number, gridY: number): Promise<TestUserFixture> {
  const admin = createTestClient(true);

  const email = `${label}-${crypto.randomUUID()}@example.com`;
  const password = "testpass123";

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    throw new Error(`Failed to create test user: ${signUpError.message}`);
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    garden_width: 5,
    garden_height: 4,
    garden_name: "Test Garden",
    location_city: "London",
  });

  if (profileError) {
    throw new Error(`Failed to create test profile: ${profileError.message}`);
  }

  const actionTypeId = await getFirstActionTypeId(admin);

  const { data: plant, error: plantError } = await admin
    .from("plants")
    .insert({
      user_id: userId,
      name: "Test Monstera",
      grid_x: gridX,
      grid_y: gridY,
    })
    .select("id")
    .single();

  if (plantError) {
    throw new Error(`Failed to create test plant: ${plantError.message}`);
  }

  const { data: action, error: actionError } = await admin
    .from("actions")
    .insert({
      plant_id: plant.id,
      action_type_id: actionTypeId,
      date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (actionError) {
    throw new Error(`Failed to create test action: ${actionError.message}`);
  }

  return {
    userId,
    plantId: plant.id,
    actionId: action.id,
    actionTypeId,
    gardenWidth: 5,
    gardenHeight: 4,
    email,
    password,
  };
}

/**
 * Create test user and seed data for photo upload tests
 * Returns user auth session, plant ID, action ID, and auth cookies
 */
export async function seedTestData(): Promise<TestUserFixture> {
  return seedUserFixture("test", 0, 0);
}

/**
 * Two isolated users for cross-user / RLS integration tests.
 * Cleanup order in tests: userA then userB (or both in finally).
 */
export async function seedTwoUsers(): Promise<{ userA: TestUserFixture; userB: TestUserFixture }> {
  const userA = await seedUserFixture("user-a", 0, 0);
  const userB = await seedUserFixture("user-b", 1, 0);
  return { userA, userB };
}

/**
 * Fetch the first seeded action type ID (for action API tests).
 */
export async function getFirstActionTypeId(supabase = createTestClient()) {
  const { data: actionType, error } = await supabase.from("action_types").select("id").limit(1).single();

  if (error) {
    throw new Error(`No action types found. Run migrations first: ${error.message}`);
  }

  return actionType.id;
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
export function createTestFile(name = "test.jpg", type = "image/jpeg", size = 1024): File {
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
