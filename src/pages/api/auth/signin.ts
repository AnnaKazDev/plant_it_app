import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { fetchGardenProfile, isGardenProfileComplete } from "@/lib/profile";

export const prerender = false;

function formatAuthError(message: string): string {
  if (message === "Network connection lost." || message === "Failed to fetch") {
    return "Cannot connect to Supabase. If developing locally, run: npx supabase start";
  }
  return message;
}

function safeRedirectPath(next: string | null): string | null {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export const POST: APIRoute = async (context) => {
  const next = safeRedirectPath(context.url.searchParams.get("next"));

  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed") || message.includes("not confirmed")) {
      return context.redirect("/auth/confirm-email?reason=unconfirmed");
    }
    const signInParams = new URLSearchParams({ error: formatAuthError(error.message) });
    if (next) {
      signInParams.set("next", next);
    }
    return context.redirect(`/auth/signin?${signInParams.toString()}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await fetchGardenProfile(supabase, user.id);
    if (!isGardenProfileComplete(profile)) {
      const setupParams = new URLSearchParams();
      if (next) {
        setupParams.set("next", next);
      }
      const setupQuery = setupParams.toString() ? `?${setupParams.toString()}` : "";
      return context.redirect(`/garden/setup${setupQuery}`);
    }
  }

  return context.redirect(next ?? "/");
};
