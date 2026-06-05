/**
 * Integration tests for /api/photos/upload endpoint
 *
 * PREREQUISITES:
 * 1. Start local Supabase:
 *      npx supabase start
 *
 * 2. Start dev server in a separate terminal:
 *      npm run dev
 *
 * 3. Run tests:
 *      npm run test:integration
 *
 * NOTE: These are E2E tests that make real HTTP requests to the running dev server.
 * If dev server is not running, all tests will fail with 403/network errors.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seedTestData, cleanupTestData, createTestFile, createTestClient } from "@/lib/test-utils";

describe("POST /api/photos/upload", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let apiUrl: string;

  beforeAll(async () => {
    // Seed test data (user, plant, action)
    testData = await seedTestData();
    apiUrl = process.env.API_URL || "http://localhost:4321";

    console.log("Test data seeded:");
    console.log(`  User ID: ${testData.userId}`);
    console.log(`  Action ID: ${testData.actionId}`);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(testData.userId);
  });

  it("should upload a valid photo and return 201 with photo metadata", async () => {
    const file = createTestFile("test-photo.jpg", "image/jpeg", 5 * 1024); // 5KB
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: {
        Cookie: `sb-access-token=${testData.session?.access_token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("photo");
    expect(json.photo).toHaveProperty("id");
    expect(json.photo).toHaveProperty("photo_url");
    expect(json.photo).toHaveProperty("size_bytes", file.size);
    expect(json.photo).toHaveProperty("order_index", 1);

    // Verify photo exists in database
    const supabase = createTestClient();
    const { data: photo } = await supabase
      .from("photos")
      .select("*")
      .eq("id", json.photo.id)
      .single();

    expect(photo).toBeTruthy();
    expect(photo?.action_id).toBe(testData.actionId);
    expect(photo?.photo_url).toBe(json.photo.photo_url);
  });

  it("should reject invalid MIME type with 400 INVALID_FILE_TYPE", async () => {
    const file = createTestFile("test.txt", "text/plain", 1024);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: {
        Cookie: `sb-access-token=${testData.session?.access_token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("INVALID_FILE_TYPE");
    expect(json.error.message).toContain("Invalid file type");
  });

  it("should reject file larger than 10MB with 413 FILE_TOO_LARGE", async () => {
    const file = createTestFile("large.jpg", "image/jpeg", 11 * 1024 * 1024); // 11MB
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: {
        Cookie: `sb-access-token=${testData.session?.access_token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(413);

    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("FILE_TOO_LARGE");
    expect(json.error.message).toContain("File too large");
  });

  it("should reject 6th photo upload with 400 MAX_PHOTOS_EXCEEDED", async () => {
    // Upload 5 photos first
    for (let i = 0; i < 5; i++) {
      const file = createTestFile(`photo-${i}.jpg`, "image/jpeg", 1024);
      const formData = new FormData();
      formData.append("action_id", testData.actionId);
      formData.append("file", file);

      const response = await fetch(`${apiUrl}/api/photos/upload`, {
        method: "POST",
        headers: {
          Cookie: `sb-access-token=${testData.session?.access_token}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);
    }

    // Try to upload 6th photo
    const file = createTestFile("photo-6.jpg", "image/jpeg", 1024);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: {
        Cookie: `sb-access-token=${testData.session?.access_token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("MAX_PHOTOS_EXCEEDED");
    expect(json.error.message).toContain("Maximum 5 photos");
  });

  it("should reject unauthenticated request with 401", async () => {
    const file = createTestFile("test.jpg", "image/jpeg", 1024);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      // No Cookie header - unauthenticated
      body: formData,
    });

    // Middleware redirects to /auth/signin (302) or returns 401
    expect([302, 401]).toContain(response.status);
  });

  it("should reject cross-user action access with 404 (RLS)", async () => {
    // Create a second user
    const secondUser = await seedTestData();

    try {
      const file = createTestFile("test.jpg", "image/jpeg", 1024);
      const formData = new FormData();
      // Try to upload to first user's action with second user's auth
      formData.append("action_id", testData.actionId);
      formData.append("file", file);

      const response = await fetch(`${apiUrl}/api/photos/upload`, {
        method: "POST",
        headers: {
          Cookie: `sb-access-token=${secondUser.session?.access_token}`,
        },
        body: formData,
      });

      expect(response.status).toBe(404);

      const json = await response.json();
      expect(json).toHaveProperty("error");
      expect(json.error.code).toBe("ACTION_NOT_FOUND");
    } finally {
      // Clean up second user
      await cleanupTestData(secondUser.userId);
    }
  });
});
