/**
 * Integration tests for POST /api/actions
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seedTestData, cleanupTestData } from "@/lib/test-utils";

interface ActionSuccessResponse {
  success: true;
  action: {
    id: string;
    plant_id: string;
    action_type_id: string | null;
    custom_action_name: string | null;
    date: string;
    weather_data: unknown;
    created_at: string;
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("POST /api/actions", () => {
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

  it("should create an action with action_type_id and return 201", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as ActionSuccessResponse;
    expect(json.success).toBe(true);
    expect(json.action.plant_id).toBe(testData.plantId);
    expect(json.action.action_type_id).toBe(testData.actionTypeId);
    expect(json.action.custom_action_name).toBeNull();
    expect(json.action.id).toBeTruthy();
  });

  it("should create an action with custom_action_name and return 201", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        plant_id: testData.plantId,
        custom_action_name: "Custom pruning",
        date: "2026-06-11",
      }),
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as ActionSuccessResponse;
    expect(json.success).toBe(true);
    expect(json.action.custom_action_name).toBe("Custom pruning");
    expect(json.action.action_type_id).toBeNull();
  });

  it("should reject both action_type_id and custom_action_name with 400 VALIDATION_ERROR", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        custom_action_name: "Both set",
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject missing action name fields with 400 VALIDATION_ERROR", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        plant_id: testData.plantId,
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject unknown plant_id with 404 PLANT_NOT_FOUND", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testData.userId,
        Origin: apiUrl,
      },
      body: JSON.stringify({
        plant_id: "00000000-0000-0000-0000-000000000000",
        action_type_id: testData.actionTypeId,
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("PLANT_NOT_FOUND");
  });

  it("should reject unauthenticated request with 401 or redirect", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: apiUrl,
      },
      redirect: "manual",
      body: JSON.stringify({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(401);
  });
});
