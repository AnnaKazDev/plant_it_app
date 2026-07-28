import type { APIRoute } from "astro";

const EMBEDDED_API_KEY = "sk-gate-test-not-real-but-looks-like-secret";

export const post: APIRoute = async (context) => {
  const body = (await context.request.json()) as Record<string, unknown>;
  console.log("gate-test payload", body.password, EMBEDDED_API_KEY);

  return Response.json({ received: body });
};
