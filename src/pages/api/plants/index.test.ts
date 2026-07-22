/**
 * Integration tests for POST /api/plants
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestClient,
  getFirstActionTypeId,
  seedTestData,
  cleanupTestData,
  buildTestAuthHeaders,
} from "@/lib/test-utils";

interface PlantSuccessResponse {
  success: true;
  plant: {
    id: string;
    name: string;
    grid_x: number;
    grid_y: number;
    icon_name: string;
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
  let ownerHeaders: Record<string, string>;

  beforeAll(async () => {
    testData = await seedTestData();
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
    ownerHeaders = await buildTestAuthHeaders(testData, apiUrl);
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
        ...ownerHeaders,
        "Content-Type": "application/json",
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

  it("should create a plant with valid icon_name and return it", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Cherry Tomato",
        grid_x: 2,
        grid_y: 1,
        icon_name: "cherry",
      }),
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as PlantSuccessResponse;
    expect(json.success).toBe(true);
    expect(json.plant.icon_name).toBe("cherry");
  });

  it("should default icon_name to sprout when omitted", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Default Icon Plant",
        grid_x: 3,
        grid_y: 1,
      }),
    });

    expect(response.status).toBe(201);

    const json = (await response.json()) as PlantSuccessResponse;
    expect(json.plant.icon_name).toBe("sprout");
  });

  it("should reject invalid icon_name with 400 VALIDATION_ERROR", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Bad Icon Plant",
        grid_x: 0,
        grid_y: 2,
        icon_name: "not-a-real-icon",
      }),
    });

    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject out-of-bounds grid position with 400 INVALID_GRID_POSITION", async () => {
    if (!testData) throw new Error("Test data not initialized");

    const response = await fetch(`${apiUrl}/api/plants`, {
      method: "POST",
      headers: {
        ...ownerHeaders,
        "Content-Type": "application/json",
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
        ...ownerHeaders,
        "Content-Type": "application/json",
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

    expect(response.status).toBe(401);
  });
});

interface PlantListSuccessResponse {
  success: true;
  plants: {
    id: string;
    display_name: string;
    signed_photo_url: string | null;
    last_action: {
      id: string;
      date: string;
    } | null;
    planned_action_count: number;
  }[];
}

async function seedUserWithProfile() {
  const admin = createTestClient(true);
  const email = `list-test-${crypto.randomUUID()}@example.com`;
  const password = "testpass123";

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    throw new Error(`Failed to create test user: ${signUpError.message}`);
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    garden_width: 5,
    garden_height: 4,
    garden_name: "List Test Garden",
    location_city: "London",
  });

  if (profileError) {
    throw new Error(`Failed to create test profile: ${profileError.message}`);
  }

  return { userId, email, password, admin };
}

describe("GET /api/plants", () => {
  // POST-origin create→read-back for last_action is covered in critical-path.test.ts (Risk #1).
  let apiUrl: string;
  let listTestUserId: string;
  let listOwnerHeaders: Record<string, string>;
  let plantNoActionsId: string;
  let plantMultiActionId: string;
  let plantRecentId: string;

  beforeAll(async () => {
    apiUrl = process.env.API_URL ?? "http://localhost:4321";

    const { userId, email, password, admin } = await seedUserWithProfile();
    listTestUserId = userId;
    listOwnerHeaders = await buildTestAuthHeaders({ userId, email, password }, apiUrl);
    const actionTypeId = await getFirstActionTypeId(admin);

    const { data: plantNoActions, error: noActionsError } = await admin
      .from("plants")
      .insert({
        user_id: listTestUserId,
        name: "Silent Plant",
        grid_x: 0,
        grid_y: 0,
        created_at: "2010-01-01T00:00:00Z",
      })
      .select("id")
      .single();

    if (noActionsError) {
      throw new Error(`Failed to create plant without actions: ${noActionsError.message}`);
    }

    plantNoActionsId = plantNoActions.id;

    const { data: plantMulti, error: multiError } = await admin
      .from("plants")
      .insert({
        user_id: listTestUserId,
        name: "Busy Plant",
        grid_x: 1,
        grid_y: 1,
      })
      .select("id")
      .single();

    if (multiError) {
      throw new Error(`Failed to create multi-action plant: ${multiError.message}`);
    }

    plantMultiActionId = plantMulti.id;

    const { error: actionsError } = await admin.from("actions").insert([
      { plant_id: plantMultiActionId, action_type_id: actionTypeId, date: "2018-03-01" },
      { plant_id: plantMultiActionId, action_type_id: actionTypeId, date: "2020-01-15" },
      { plant_id: plantMultiActionId, action_type_id: actionTypeId, date: "2030-06-01" },
    ]);

    if (actionsError) {
      throw new Error(`Failed to seed multi-action plant: ${actionsError.message}`);
    }

    const { data: plantRecent, error: recentError } = await admin
      .from("plants")
      .insert({
        user_id: listTestUserId,
        name: "Recent Plant",
        grid_x: 2,
        grid_y: 0,
      })
      .select("id")
      .single();

    if (recentError) {
      throw new Error(`Failed to create recent plant: ${recentError.message}`);
    }

    plantRecentId = plantRecent.id;

    const { error: recentActionError } = await admin.from("actions").insert({
      plant_id: plantRecentId,
      action_type_id: actionTypeId,
      date: "2026-05-20",
    });

    if (recentActionError) {
      throw new Error(`Failed to seed recent plant action: ${recentActionError.message}`);
    }
  });

  afterAll(async () => {
    if (listTestUserId) {
      await cleanupTestData(listTestUserId);
    }
  });

  it("should reject unauthenticated request with 401", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: { Origin: apiUrl },
    });

    expect(response.status).toBe(401);
  });

  it("should return an empty list for a user with no plants", async () => {
    const { userId, email, password } = await seedUserWithProfile();

    try {
      const headers = await buildTestAuthHeaders({ userId, email, password }, apiUrl);
      const response = await fetch(`${apiUrl}/api/plants`, {
        headers,
      });

      expect(response.status).toBe(200);

      const json = (await response.json()) as PlantListSuccessResponse;
      expect(json.success).toBe(true);
      expect(json.plants).toEqual([]);
    } finally {
      await cleanupTestData(userId);
    }
  });

  it("should return last_action null when a plant has no actions", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: listOwnerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantListSuccessResponse;
    const plant = json.plants.find((item) => item.id === plantNoActionsId);
    expect(plant).toBeDefined();
    expect(plant?.last_action).toBeNull();
  });

  it("should return the newest action as last_action when multiple actions exist", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: listOwnerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantListSuccessResponse;
    const plant = json.plants.find((item) => item.id === plantMultiActionId);
    expect(plant).toBeDefined();
    expect(plant?.last_action?.date.slice(0, 10)).toBe("2030-06-01");
  });

  it("should return planned_action_count matching future-dated actions", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: listOwnerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantListSuccessResponse;
    const busyPlant = json.plants.find((item) => item.id === plantMultiActionId);
    const recentPlant = json.plants.find((item) => item.id === plantRecentId);

    expect(busyPlant?.planned_action_count).toBe(1);
    expect(recentPlant?.planned_action_count).toBe(0);
  });

  it("should return plants sorted by activity date descending", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: listOwnerHeaders,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantListSuccessResponse;
    expect(json.plants.length).toBe(3);

    const activityDates = json.plants.map((plant) => {
      if (plant.last_action) {
        return new Date(plant.last_action.date).getTime();
      }

      if (plant.id === plantNoActionsId) {
        return new Date("2010-01-01T00:00:00Z").getTime();
      }

      return 0;
    });

    for (let i = 0; i < activityDates.length - 1; i++) {
      expect(activityDates[i]).toBeGreaterThanOrEqual(activityDates[i + 1]);
    }

    expect(json.plants[0]?.id).toBe(plantMultiActionId);
    expect(json.plants[1]?.id).toBe(plantRecentId);
    expect(json.plants[2]?.id).toBe(plantNoActionsId);
  });
});
