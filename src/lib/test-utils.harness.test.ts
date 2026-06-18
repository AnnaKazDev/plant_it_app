/**
 * Harness smoke test: proves integration auth exercises RLS (Risk #3 enabler)
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect } from "vitest";
import { seedTwoUsers, cleanupTestData, signInTestUser, createTestFile } from "@/lib/test-utils";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("integration test harness RLS smoke (Risk #3)", () => {
  const apiUrl = process.env.API_URL ?? "http://localhost:4321";

  it("user B cannot upload to user A action via signInTestUser session (RLS)", async () => {
    const { userA, userB } = await seedTwoUsers();

    try {
      const sessionHeaders = await signInTestUser(userB.email, userB.password);
      const file = createTestFile("cross-user.jpg", "image/jpeg", 1024);
      const formData = new FormData();
      formData.append("action_id", userA.actionId);
      formData.append("file", file);

      const response = await fetch(`${apiUrl}/api/photos/upload`, {
        method: "POST",
        headers: {
          ...sessionHeaders,
          Origin: apiUrl,
        },
        body: formData,
      });

      expect(response.status).toBe(404);

      const json = (await response.json()) as ErrorResponse;
      expect(json.error.code).toBe("ACTION_NOT_FOUND");
    } finally {
      await cleanupTestData(userA.userId);
      await cleanupTestData(userB.userId);
    }
  });
});
