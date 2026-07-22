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
import {
  seedTestData,
  cleanupTestData,
  createTestFile,
  createTestClient,
  buildTestAuthHeaders,
} from "@/lib/test-utils";

const PRD_MAX_PHOTOS_PER_ACTION = 5;
const PRD_MAX_PHOTO_BYTES = 10 * 1024 * 1024;

interface UploadSuccessResponse {
  success: true;
  photo: {
    id: string;
    photo_url: string;
    size_bytes: number;
    order_index: number;
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

async function countPhotosForAction(actionId: string): Promise<number> {
  const admin = createTestClient(true);
  const { count, error } = await admin
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("action_id", actionId);

  if (error) {
    throw new Error(`Failed to count photos: ${error.message}`);
  }

  return count ?? 0;
}

describe("POST /api/photos/upload", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>> | undefined;
  let apiUrl: string;
  let ownerHeaders: Record<string, string>;

  beforeAll(async () => {
    // Seed test data (user, plant, action)
    testData = await seedTestData();
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
    ownerHeaders = await buildTestAuthHeaders(testData, apiUrl);
  });

  afterAll(async () => {
    // Clean up test data (only if setup succeeded)
    if (testData?.userId) {
      await cleanupTestData(testData.userId);
    }
  });

  it("should upload a valid photo and return 201 with photo metadata", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const file = createTestFile("test-photo.jpg", "image/jpeg", 5 * 1024); // 5KB
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: ownerHeaders,
      body: formData,
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as UploadSuccessResponse;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("photo");
    expect(json.photo).toHaveProperty("id");
    expect(json.photo).toHaveProperty("photo_url");
    expect(json.photo).toHaveProperty("size_bytes", file.size);
    expect(json.photo).toHaveProperty("order_index", 1);

    // Verify photo exists in database (use service role to bypass RLS)
    const supabase = createTestClient(true);
    const { data: photo } = await supabase.from("photos").select("*").eq("id", json.photo.id).single();

    expect(photo).toBeTruthy();
    expect(photo?.action_id).toBe(testData.actionId);
    expect(photo?.photo_url).toBe(json.photo.photo_url);
  });

  it("rejects invalid MIME with 400 INVALID_FILE_TYPE and unchanged photo count (Risk #6)", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countPhotosForAction(testData.actionId);
    const file = createTestFile("test.txt", "text/plain", 1024);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: ownerHeaders,
      body: formData,
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("INVALID_FILE_TYPE");
    expect(json.error.message).toContain("Invalid file type");
    expect(await countPhotosForAction(testData.actionId)).toBe(before);
  });

  it("rejects file over PRD max bytes with 413 FILE_TOO_LARGE and unchanged photo count (Risk #6)", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countPhotosForAction(testData.actionId);
    const file = createTestFile("large.jpg", "image/jpeg", PRD_MAX_PHOTO_BYTES + 1);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: ownerHeaders,
      body: formData,
    });

    expect(response.status).toBe(413);

    const json = (await response.json()) as ErrorResponse;
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("FILE_TOO_LARGE");
    expect(json.error.message).toContain("File too large");
    expect(await countPhotosForAction(testData.actionId)).toBe(before);
  });

  it("rejects upload beyond PRD max photos with MAX_PHOTOS_EXCEEDED and photo count stays at limit (Risk #6)", async () => {
    if (!testData) throw new Error("Test data not initialized");

    // Clean up any existing photos for this action first
    const supabase = createTestClient(true); // Use service role for cleanup
    await supabase.from("photos").delete().eq("action_id", testData.actionId);

    // Upload PRD max photos first
    for (let i = 0; i < PRD_MAX_PHOTOS_PER_ACTION; i++) {
      const file = createTestFile(`photo-${i}.jpg`, "image/jpeg", 1024);
      const formData = new FormData();
      formData.append("action_id", testData.actionId);
      formData.append("file", file);

      const response = await fetch(`${apiUrl}/api/photos/upload`, {
        method: "POST",
        headers: ownerHeaders,
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
      headers: ownerHeaders,
      body: formData,
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("MAX_PHOTOS_EXCEEDED");
    expect(json.error.message).toContain("Maximum 5 photos");
    expect(await countPhotosForAction(testData.actionId)).toBe(PRD_MAX_PHOTOS_PER_ACTION);
  });

  it("should reject unauthenticated request with 401", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const file = createTestFile("test.jpg", "image/jpeg", 1024);
    const formData = new FormData();
    formData.append("action_id", testData.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: {
        Origin: apiUrl, // Bypass CSRF to test auth
      },
      redirect: "manual", // Don't follow redirects
      // No X-Test-User-Id header - unauthenticated
      body: formData,
    });

    // Middleware redirects to /auth/signin (302) or endpoint returns 401
    expect(response.status).toBe(401);
  });
});
