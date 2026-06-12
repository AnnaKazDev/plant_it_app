import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { ERROR_CODES } from "@/types";
import type { ApiError } from "@/types";

export const prerender = false;

function jsonError(error: ApiError, status: number): Response {
  return Response.json({ error }, { status });
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonError({ code: ERROR_CODES.UNAUTHORIZED, message: "Authentication required" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError({ code: "INTERNAL_ERROR", message: "Failed to initialize database client" }, 500);
  }

  const { data: actionTypes, error } = await supabase
    .from("action_types")
    .select("id, name, icon_emoji")
    .order("name", { ascending: true });

  if (error) {
    return jsonError(
      {
        code: "DATABASE_ERROR",
        message: "Failed to fetch action types",
        details: { error: error.message },
      },
      500,
    );
  }

  return Response.json({
    success: true,
    action_types: actionTypes,
  });
};
