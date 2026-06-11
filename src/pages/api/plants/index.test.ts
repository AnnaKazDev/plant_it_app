/**
 * Integration tests for POST /api/plants
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seedTestData, cleanupTestData } from "@/lib/test-utils";

interface PlantSuccessResponse {
  success: true;
  plant: {
    id: string;
    name: string;
    grid_x: number;
    grid_y: number;
    photo_url: string | null;
    display_name: string;
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("POST /api/plants", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>> | undefined;
  let apiUrl: string;

  beforeAll(async () => {
    testData = await seedTestData();
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
  });

  afterAll(async () => {
    if (testData?.userId) {
      await cleanupTestData(testData.userId);
    }
  });

  it("should create a plant with valid input and return 201", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        name: "API Test Fern",
        grid_x: 1,
        grid_y: 1,
      }),
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as PlantSuccessResponse;
    expect(json.success).toBe(true);
    expect(json.plant.name).toBe("API Test Fern");
    expect(json.plant.grid_x).toBe(1);
    expect(json.plant.grid_y).toBe(1);
    expect(json.plant.id).toBeTruthy();
    expect(json.plant.display_name).toContain("API Test Fern");
  });

  it("should reject out-of-bounds grid position with 400 INVALID_GRID_POSITION", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        name: "Out of Bounds Plant",
        grid_x: 99,
        grid_y: 0,
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("INVALID_GRID_POSITION");
  });

  it("should reject empty name with 400 VALIDATION_ERROR", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        name: "",
        grid_x: 2,
        grid_y: 2,
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject unauthenticated request with 401 or redirect", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: apiUrl,
      },
      redirect: "manual",
      body: JSON.stringify({
        name: "Unauthorized Plant",
        grid_x: 0,
        grid_y: 0,
      }),
    });

    expect([302, 401]).toContain(response.status);
  });
});
