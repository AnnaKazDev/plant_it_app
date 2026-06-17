import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";
import type { Database } from "@/types";
import { createTestClient } from "@/lib/test-utils";

/** Decode JWT role claim without verifying signature (config sanity check only). */
export function getSupabaseKeyRole(key: string): string | null {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json) as { role?: unknown };
    return typeof data.role === "string" ? data.role : null;
  } catch {
    return null;
  }
}

/** Server-only client that bypasses RLS — use only for trusted server operations (e.g. signup profile insert). */
export function createServiceRoleClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const role = getSupabaseKeyRole(SUPABASE_SERVICE_ROLE_KEY);
  if (role !== "service_role") {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY has role "${role ?? "unknown"}" — expected "service_role". ` +
        "Use the service_role key from Supabase Dashboard → Project Settings → API, not the anon key.",
    );
    return null;
  }

  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }

  // TEST MODE: If X-Test-User-Id header is present (non-production only),
  // use service role client to bypass RLS (test middleware already verified the user)
  if (!import.meta.env.PROD) {
    const testUserId = requestHeaders.get("X-Test-User-Id");
    if (testUserId) {
      // Return a service role client that will have full access
      // The middleware has already verified this is a valid test user
      return createTestClient(true); // Use service role key
    }
  }

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
