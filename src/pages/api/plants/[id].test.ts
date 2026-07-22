/**
 * Integration tests for GET /api/plants/[id]
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seedTestData, cleanupTestData, buildTestAuthHeaders } from "@/lib/test-utils";

interface PlantDetailSuccessResponse {
  success: true;
  plant: {
    id: string;
    actions: {
      id: string;
      date: string;
      additional_data: string | null;
    }[];
  };
}

describe("GET /api/plants/[id]", () => {
  let testData: Awaited<ReturnType<typeof seedTestData>> | undefined;
  let apiUrl: string;
  let ownerHeaders: Record<string, string>;

  const actionDates = {
    past: "2020-03-10",
    today: "2026-06-12",
    future: "2030-08-20",
  };

  beforeAll(async () => {
    testData = await seedTestData();
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
    ownerHeaders = await buildTestAuthHeaders(testData, apiUrl);

    const headers = {
      ...ownerHeaders,
      "Content-Type": "application/json",
    };

    for (const date of Object.values(actionDates)) {
      const response = await fetch(`${apiUrl}/api/actions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          plant_id: testData.plantId,
          action_type_id: testData.actionTypeId,
          date,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to seed action for date ${date}: ${response.status}`);
      }
    }
  });

  afterAll(async () => {
    if (testData?.userId) {
      await cleanupTestData(testData.userId);
    }
  });

  it("should return all actions sorted newest-first", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants/${testData.plantId}`, {
      headers: ownerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantDetailSuccessResponse;
    expect(json.success).toBe(true);
    expect(json.plant.id).toBe(testData.plantId);
    expect(json.plant.actions.length).toBeGreaterThanOrEqual(3);

    const dates = json.plant.actions.map((action) => new Date(action.date).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }

    const sortedUniqueDates = [...new Set(json.plant.actions.map((a) => a.date.slice(0, 10)))];
    expect(sortedUniqueDates).toContain(actionDates.future);
    expect(sortedUniqueDates).toContain(actionDates.past);
  });

  it("should return additional_data on actions after create with notes", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const notes = "Organic fertilizer, 5L water";
    const createResponse = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plant_id: testData.plantId,
        action_type_id: testData.actionTypeId,
        date: "2026-06-08",
        additional_data: notes,
      }),
    });

    expect(createResponse.status).toBe(201);

    const createJson = (await createResponse.json()) as {
      action: { id: string; additional_data: string };
    };
    const actionId = createJson.action.id;

    const response = await fetch(`${apiUrl}/api/plants/${testData.plantId}`, {
      headers: ownerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantDetailSuccessResponse;
    const action = json.plant.actions.find((item) => item.id === actionId);
    expect(action).toBeDefined();
    expect(action?.additional_data).toBe(notes);
  });
});
