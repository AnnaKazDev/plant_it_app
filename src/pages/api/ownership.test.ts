/**
 * Two-user ownership boundary integration tests (Risk #3)
 *
 * Proves authenticated User B cannot read or mutate User A's plant, action, or photo.
 * Asserts 404 / empty list — not 401-only, not 403.
 *
 * PREREQUISITES: local Supabase (`npx supabase start`) and dev server (`npm run dev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  seedTwoUsers,
  cleanupTestData,
  buildTestAuthHeaders,
  createTestFile,
  createTestClient,
  getRowCounts,
  type TestUserFixture,
} from "@/lib/test-utils";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

interface PlantListSuccessResponse {
  success: true;
  plants: { id: string }[];
}

interface PlantCardResponse {
  success?: true;
  plant: {
    actions: Array<{
      id: string;
      additional_data: string | null;
      photos?: Array<{
        signed_photo_url: string;
      }>;
    }>;
  };
}

function jsonHeaders(headers: Record<string, string>) {
  return {
    ...headers,
    "Content-Type": "application/json",
  };
}

describe("Two-user ownership boundaries (Risk #3)", () => {
  let userA: TestUserFixture;
  let userB: TestUserFixture;
  let apiUrl: string;
  let headersA: Record<string, string>;
  let headersB: Record<string, string>;

  beforeAll(async () => {
    const users = await seedTwoUsers();
    userA = users.userA;
    userB = users.userB;
    apiUrl = process.env.API_URL ?? "http://localhost:4321";
    headersA = await buildTestAuthHeaders(userA, apiUrl);
    headersB = await buildTestAuthHeaders(userB, apiUrl);
  });

  afterAll(async () => {
    if (userA?.userId) {
      await cleanupTestData(userA.userId);
    }
    if (userB?.userId) {
      await cleanupTestData(userB.userId);
    }
  });

  it("user B cannot GET user A plant (404 PLANT_NOT_FOUND)", async () => {
    const response = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersB,
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("PLANT_NOT_FOUND");
  });

  it("user B cannot DELETE user A plant; user A plant still readable", async () => {
    const deleteResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      method: "DELETE",
      headers: headersB,
    });

    expect(deleteResponse.status).toBe(404);

    const deleteJson = (await deleteResponse.json()) as ErrorResponse;
    expect(deleteJson.error.code).toBe("PLANT_NOT_FOUND");

    const getResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersA,
    });

    expect(getResponse.status).toBe(200);
  });

  it("user B cannot POST action on user A plant (404 PLANT_NOT_FOUND)", async () => {
    const admin = createTestClient(true);
    const before = await getRowCounts(admin, { plantId: userA.plantId });

    const response = await fetch(`${apiUrl}/api/actions`, {
      method: "POST",
      headers: jsonHeaders(headersB),
      body: JSON.stringify({
        plant_id: userA.plantId,
        action_type_id: userB.actionTypeId,
        date: "2026-06-10",
      }),
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("PLANT_NOT_FOUND");

    const after = await getRowCounts(admin, { plantId: userA.plantId });
    expect(after.actions).toBe(before.actions);
  });

  it("user B cannot PATCH user A action (404 ACTION_NOT_FOUND)", async () => {
    const response = await fetch(`${apiUrl}/api/actions/${userA.actionId}`, {
      method: "PATCH",
      headers: jsonHeaders(headersB),
      body: JSON.stringify({
        additional_data: "cross-user edit attempt",
      }),
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("ACTION_NOT_FOUND");

    const getResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersA,
    });

    expect(getResponse.status).toBe(200);

    const plantJson = (await getResponse.json()) as PlantCardResponse;
    const action = plantJson.plant.actions.find((item) => item.id === userA.actionId);

    expect(action).toBeDefined();
    expect(action?.additional_data).not.toBe("cross-user edit attempt");
  });

  it("user B cannot DELETE user A action (404 ACTION_NOT_FOUND)", async () => {
    const response = await fetch(`${apiUrl}/api/actions/${userA.actionId}`, {
      method: "DELETE",
      headers: headersB,
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("ACTION_NOT_FOUND");

    const getResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersA,
    });

    expect(getResponse.status).toBe(200);

    const plantJson = (await getResponse.json()) as PlantCardResponse;
    expect(plantJson.plant.actions.some((item) => item.id === userA.actionId)).toBe(true);
  });

  it("user B cannot upload photo to user A action (404 ACTION_NOT_FOUND)", async () => {
    const admin = createTestClient(true);
    const before = await getRowCounts(admin, { actionId: userA.actionId });

    const file = createTestFile("cross-user.jpg", "image/jpeg", 1024);
    const formData = new FormData();
    formData.append("action_id", userA.actionId);
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: headersB,
      body: formData,
    });

    expect(response.status).toBe(404);

    const json = (await response.json()) as ErrorResponse;
    expect(json.error.code).toBe("ACTION_NOT_FOUND");

    const after = await getRowCounts(admin, { actionId: userA.actionId });
    expect(after.photos).toBe(before.photos);
  });

  it("user B plant list excludes user A plants", async () => {
    const response = await fetch(`${apiUrl}/api/plants`, {
      headers: headersB,
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as PlantListSuccessResponse;
    const plantIds = json.plants.map((plant) => plant.id);

    expect(plantIds).not.toContain(userA.plantId);
    expect(plantIds).toContain(userB.plantId);
  });

  it("user B cannot obtain user A photo URLs via plant APIs", async () => {
    const file = createTestFile("owner-photo.jpg", "image/jpeg", 1024);
    const formData = new FormData();
    formData.append("action_id", userA.actionId);
    formData.append("file", file);

    const uploadResponse = await fetch(`${apiUrl}/api/photos/upload`, {
      method: "POST",
      headers: headersA,
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const cardResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersA,
    });

    expect(cardResponse.status).toBe(200);

    const cardJson = (await cardResponse.json()) as PlantCardResponse;
    const action = cardJson.plant.actions.find((item) => item.id === userA.actionId);
    const signedPhotoUrl = action?.photos?.[0]?.signed_photo_url;

    expect(signedPhotoUrl).toBeTruthy();

    const listResponse = await fetch(`${apiUrl}/api/plants`, {
      headers: headersB,
    });

    expect(listResponse.status).toBe(200);

    const listText = await listResponse.text();
    expect(listText).not.toContain(userA.plantId);
    expect(listText).not.toContain(signedPhotoUrl);

    const crossGetResponse = await fetch(`${apiUrl}/api/plants/${userA.plantId}`, {
      headers: headersB,
    });

    expect(crossGetResponse.status).toBe(404);
  });
}, 30_000);
