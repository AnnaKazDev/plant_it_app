import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { createTestClient } from "@/lib/test-utils";
import { ERROR_CODES } from "@/types";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/api/photos",
  "/plants",
  "/api/plants",
  "/api/actions",
  "/api/action-types",
  "/garden-map",
];

export const onRequest = defineMiddleware(async (context, next) => {
  // TEST MODE: Allow bypassing auth with X-Test-User-Id header (local dev only)
  if (import.meta.env.DEV) {
    const testUserId = context.request.headers.get("X-Test-User-Id");
    if (testUserId) {
      // Fetch the user from Supabase using the service role client
      const testClient = createTestClient(true); // Use service role key
      const {
        data: { user },
        error,
      } = await testClient.auth.admin.getUserById(testUserId);
      if (user && !error) {
        context.locals.user = user;
        return next();
      }
    }
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      if (context.url.pathname.startsWith("/api/")) {
        return Response.json(
          { error: { code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" } },
          { status: 401 },
        );
      }
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
