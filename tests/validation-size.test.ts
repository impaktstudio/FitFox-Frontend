import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";

describe("parseJsonBody size limits", () => {
  it("accepts bodies under the size limit", async () => {
    const request = new Request("https://fitfox.test/api", {
      method: "POST",
      body: JSON.stringify({ name: "Maya" })
    });

    await expect(parseJsonBody(request, z.object({ name: z.string() }))).resolves.toEqual({ name: "Maya" });
  });

  it("rejects bodies over the size limit", async () => {
    const largeBody = JSON.stringify({ data: "x".repeat(2_000_000) });
    const request = new Request("https://fitfox.test/api", {
      method: "POST",
      body: largeBody
    });

    await expect(parseJsonBody(request, z.object({ data: z.string() }))).rejects.toThrow(ApiError);
  });

  it("rejects bodies with forged Content-Length", async () => {
    const largeBody = JSON.stringify({ data: "x".repeat(2_000_000) });
    const request = new Request("https://fitfox.test/api", {
      method: "POST",
      headers: { "Content-Length": "100" },
      body: largeBody
    });

    await expect(parseJsonBody(request, z.object({ data: z.string() }))).rejects.toThrow(ApiError);
  });
});
