import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { parseJsonBody, parseRouteParams } from "@/lib/api/validation";

describe("API helpers", () => {
  it("formats success bodies consistently", async () => {
    const response = apiSuccess({ service: "FitFox" }, "req_1");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { service: "FitFox" },
      meta: { requestId: "req_1" }
    });
  });

  it("formats error bodies consistently", async () => {
    const response = apiFailure(new ApiError("validation_failed", "Invalid payload", { field: "name" }), "req_2");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Invalid payload",
        details: { field: "name" }
      },
      meta: { requestId: "req_2" }
    });
  });

  it("validates JSON request bodies", async () => {
    const request = new Request("https://fitfox.test/api", {
      method: "POST",
      body: JSON.stringify({ name: "Maya" })
    });

    await expect(parseJsonBody(request, z.object({ name: z.string() }))).resolves.toEqual({ name: "Maya" });
  });

  it("throws typed validation errors for route params", () => {
    expect(() => parseRouteParams({ itemId: "nope" }, z.object({ itemId: z.uuid() }))).toThrow(ApiError);
  });
});
