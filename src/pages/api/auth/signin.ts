import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function formatAuthError(message: string): string {
  if (message === "Network connection lost." || message === "Failed to fetch") {
    return "Cannot connect to Supabase. If developing locally, run: npx supabase start";
  }
  return message;
}

export const POST: APIRoute = async (context) => {
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
    return context.redirect(`/auth/signin?error=${encodeURIComponent(formatAuthError(error.message))}`);
  }

  return context.redirect("/");
};
