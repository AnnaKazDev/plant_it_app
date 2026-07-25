/**
 * E2E auth helpers — create confirmed users via Supabase admin API
 * (no UI signup; avoids Weather API and email confirmation).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import ws from "ws";

config({ path: path.resolve(process.cwd(), ".env") });

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export interface E2eUser {
  userId: string;
  email: string;
  password: string;
}

function adminClient() {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      transport: ws as any,
    },
  });
}

/** Fixed credentials for the reusable storageState setup user. */
export const E2E_SETUP_USER = {
  email: "e2e-setup@plant-it.local",
  password: "e2e-setup-pass-123",
} as const;

/**
 * Create (or recreate) a confirmed user with a complete garden profile.
 * Sign-in redirects to `/` instead of `/garden/setup`.
 */
export async function createE2eUser(label = "e2e"): Promise<E2eUser> {
  const admin = adminClient();
  const email = `${label}-${crypto.randomUUID()}@plant-it.local`;
  const password = "e2e-test-pass-123";

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    throw new Error(`Failed to create E2E user: ${signUpError.message}`);
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    garden_width: 5,
    garden_height: 4,
    garden_name: "E2E Garden",
    location_city: "London",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create E2E profile: ${profileError.message}`);
  }

  return { userId, email, password };
}

/**
 * Ensure the fixed setup user exists for storageState auth.
 * Deletes and recreates if the user already exists from a prior run.
 */
export async function ensureE2eSetupUser(): Promise<E2eUser> {
  const admin = adminClient();
  const { email, password } = E2E_SETUP_USER;

  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData.users.find((u) => u.email === email);
  if (existing) {
    await admin.from("plants").delete().eq("user_id", existing.id);
    await admin.from("profiles").delete().eq("id", existing.id);
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    throw new Error(`Failed to create E2E setup user: ${signUpError.message}`);
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    garden_width: 5,
    garden_height: 4,
    garden_name: "E2E Setup Garden",
    location_city: "London",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create E2E setup profile: ${profileError.message}`);
  }

  return { userId, email, password };
}

export async function deleteE2eUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.from("plants").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}
