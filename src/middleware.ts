import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { createTestClient } from "@/lib/test-utils";

const PROTECTED_ROUTES = ["/dashboard", "/api/photos", "/plants", "/api/plants", "/api/actions", "/api/action-types"];

export const onRequest = defineMiddleware(async (context, next) => {
  // TEST MODE: Allow bypassing auth with X-Test-User-Id header (non-production only)
  if (!import.meta.env.PROD) {
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
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
