/**
 * Critical-path integration tests: POST /api/actions → GET read paths (Risk #1)
 *
 * Proves action create persists and surfaces on plant card and list teaser read paths.
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isPlannedAction } from "@/lib/action-dates";
import { seedTestData, cleanupTestData } from "@/lib/test-utils";

interface ActionSuccessResponse {
  success: true;
  action: {
    id: string;
    plant_id: string;
    action_type_id: string | null;
    custom_action_name: string | null;
    date: string;
  };
}

interface PlantDetailSuccessResponse {
  success: true;
  plant: {
    id: string;
    actions: {
      id: string;
      date: string;
      custom_action_name: string | null;
      action_type: { name: string; icon_emoji: string } | null;
    }[];
  };
}

interface PlantListSuccessResponse {
  success: true;
  plants: {
    id: string;
    last_action: {
      id: string;
      date: string;
      custom_action_name: string | null;
      action_type: { name: string; icon_emoji: string } | null;
    } | null;
    planned_action_count: number;
  }[];
}

function authHeaders(userId: string, apiUrl: string) {
  return {
    "Content-Type": "application/json",
    "X-Test-User-Id": userId,
    Origin: apiUrl,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function createEmptyPlant(userId: string, apiUrl: string, gridX: number, gridY: number): Promise<string> {
  const response = await fetch(`${apiUrl}/api/plants`, {
    method: "POST",
    headers: authHeaders(userId, apiUrl),
    body: JSON.stringify({
      name: "Critical Path Plant",
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

async function postAction(
  userId: string,
  apiUrl: string,
  body: Record<string, unknown>,
): Promise<ActionSuccessResponse["action"]> {
  const response = await fetch(`${apiUrl}/api/actions`, {
    method: "POST",
    headers: authHeaders(userId, apiUrl),
    body: JSON.stringify(body),
  });

  expect(response.status).toBe(201);

  const json = (await response.json()) as ActionSuccessResponse;
  return json.action;
}

async function getPlantCard(
  userId: string,
  apiUrl: string,
  plantId: string,
): Promise<PlantDetailSuccessResponse["plant"]> {
  const response = await fetch(`${apiUrl}/api/plants/${plantId}`, {
    headers: {
      "X-Test-User-Id": userId,
      Origin: apiUrl,
    },
  });

  expect(response.status).toBe(200);

  const json = (await response.json()) as PlantDetailSuccessResponse;
  return json.plant;
}

async function getPlantList(userId: string, apiUrl: string): Promise<PlantListSuccessResponse["plants"]> {
  const response = await fetch(`${apiUrl}/api/plants`, {
    headers: {
      "X-Test-User-Id": userId,
      Origin: apiUrl,
    },
  });

  expect(response.status).toBe(200);

  const json = (await response.json()) as PlantListSuccessResponse;
  return json.plants;
}

describe("Critical path: action create → read-back (Risk #1)", () => {
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

  it("card read-back: POST past action surfaces in plant card actions array", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const plantId = await createEmptyPlant(testData.userId, apiUrl, 3, 0);
    const actionDate = "2024-03-15";
    const customName = "Deep watering";

    const created = await postAction(testData.userId, apiUrl, {
      plant_id: plantId,
      custom_action_name: customName,
      date: actionDate,
    });

    const card = await getPlantCard(testData.userId, apiUrl, plantId);
    const action = card.actions.find((item) => item.id === created.id);

    expect(action).toBeDefined();
    if (!action) return;
    expect(action.custom_action_name).toBe(customName);
    expect(action.date.slice(0, 10)).toBe(actionDate);
    expect(isPlannedAction(action.date)).toBe(false);
  });

  it("list read-back: POST past/today action surfaces as last_action on plant list", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const plantId = await createEmptyPlant(testData.userId, apiUrl, 3, 1);
    const actionDate = todayIsoDate();

    const created = await postAction(testData.userId, apiUrl, {
      plant_id: plantId,
      action_type_id: testData.actionTypeId,
      date: actionDate,
    });

    const plants = await getPlantList(testData.userId, apiUrl);
    const listItem = plants.find((item) => item.id === plantId);

    expect(listItem).toBeDefined();
    expect(listItem?.last_action?.id).toBe(created.id);
    expect(listItem?.last_action?.date.slice(0, 10)).toBe(actionDate);
    expect(listItem?.planned_action_count).toBe(0);
  });

  it("card vs list planned semantics: POST future action on card is planned, not last completed; list last_action matches", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const plantId = await createEmptyPlant(testData.userId, apiUrl, 3, 2);
    const futureDate = "2035-06-01";

    const created = await postAction(testData.userId, apiUrl, {
      plant_id: plantId,
      custom_action_name: "Scheduled fertilizing",
      date: futureDate,
    });

    const card = await getPlantCard(testData.userId, apiUrl, plantId);
    const cardAction = card.actions.find((item) => item.id === created.id);

    expect(cardAction).toBeDefined();
    if (!cardAction) return;
    expect(isPlannedAction(cardAction.date)).toBe(true);

    const planned = card.actions.filter((item) => isPlannedAction(item.date));
    const history = card.actions.filter((item) => !isPlannedAction(item.date));
    expect(planned.some((item) => item.id === created.id)).toBe(true);
    expect(history[0]?.id).not.toBe(created.id);
    expect(history).toHaveLength(0);

    const plants = await getPlantList(testData.userId, apiUrl);
    const listItem = plants.find((item) => item.id === plantId);

    expect(listItem?.last_action?.id).toBe(created.id);
    expect(listItem?.last_action?.date.slice(0, 10)).toBe(futureDate);
    expect(listItem?.planned_action_count).toBe(1);
  });
}, 30_000);
