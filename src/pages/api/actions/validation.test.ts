/**
 * Validation rejection + DB oracle tests for POST /api/actions (Risk #6)
 *
 * PRD-named constants are the oracle — do not import limits from production Zod schemas.
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seedTestData, cleanupTestData, createTestClient } from "@/lib/test-utils";

const PRD_MAX_ACTION_NAME = 300;
const PRD_MAX_NOTES = 1000;

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

function authHeaders(userId: string, apiUrl: string) {
  return {
    "Content-Type": "application/json",
    "X-Test-User-Id": userId,
    Origin: apiUrl,
  };
}

async function countActionsForPlant(plantId: string): Promise<number> {
  const admin = createTestClient(true);
  const { count, error } = await admin
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("plant_id", plantId);

  if (error) {
    throw new Error(`Failed to count actions: ${error.message}`);
  }

  return count ?? 0;
}

async function createEmptyPlant(userId: string, apiUrl: string, gridX: number, gridY: number): Promise<string> {
  const response = await fetch(`${apiUrl}/api/plants`, {
    method: "POST",
    headers: authHeaders(userId, apiUrl),
    body: JSON.stringify({
      name: "Validation Test Plant",
      grid_x: gridX,
      grid_y: gridY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create plant: ${response.status}`);
  }

  const json = (await response.json()) as { plant: { id: string } };
  return json.plant.id;
}

describe("POST /api/actions validation rejection + DB oracle (Risk #6)", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>> | undefined;
  let apiUrl: string;
  let plantId: string;

  beforeAll(async () => {
    testData = await seedTestData();
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
    plantId = await createEmptyPlant(testData.userId, apiUrl, 3, 3);
  });

  afterAll(async () => {
    if (testData?.userId) {
      await cleanupTestData(testData.userId);
    }
  });

  it("accepts custom_action_name at PRD max length (300) and increments action count", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);
    const name = "a".repeat(PRD_MAX_ACTION_NAME);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        custom_action_name: name,
        date: "2035-01-01",
      }),
    });

    expect(response.status).toBe(201);
    expect(await countActionsForPlant(plantId)).toBe(before + 1);
  });

  it("rejects custom_action_name over PRD max (301) with VALIDATION_ERROR and unchanged action count", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);
    const name = "a".repeat(PRD_MAX_ACTION_NAME + 1);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        custom_action_name: name,
        date: "2035-01-02",
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(await countActionsForPlant(plantId)).toBe(before);
  });

  it("accepts additional_data at PRD max length (1000) and increments action count", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);
    const notes = "n".repeat(PRD_MAX_NOTES);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        action_type_id: testData.actionTypeId,
        date: "2035-01-03",
        additional_data: notes,
      }),
    });

    expect(response.status).toBe(201);
    expect(await countActionsForPlant(plantId)).toBe(before + 1);
  });

  it("rejects additional_data over PRD max (1001) with VALIDATION_ERROR and unchanged action count", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);
    const notes = "n".repeat(PRD_MAX_NOTES + 1);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        action_type_id: testData.actionTypeId,
        date: "2035-01-04",
        additional_data: notes,
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(await countActionsForPlant(plantId)).toBe(before);
  });

  it.each([
    ["not-a-date", "invalid date string"],
    ["", "empty date string"],
  ])("rejects date %s (%s) with VALIDATION_ERROR and unchanged action count", async (date) => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        custom_action_name: "Valid name",
        date,
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(await countActionsForPlant(plantId)).toBe(before);
  });

  it("rejects whitespace-only custom_action_name with VALIDATION_ERROR and unchanged action count", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const before = await countActionsForPlant(plantId);

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: authHeaders(testData.userId, apiUrl),
      body: JSON.stringify({
        plant_id: plantId,
        custom_action_name: "   ",
        date: "2035-01-05",
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(await countActionsForPlant(plantId)).toBe(before);
  });
}, 30_000);
