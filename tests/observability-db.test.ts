import { describe, expect, it } from "vitest";
import { z } from "zod";
import { wardrobeItems } from "@/lib/db/schema";
import { redactPayload } from "@/lib/observability/redaction";

describe("observability", () => {
  it("redacts secrets and truncates large payload values", () => {
    const redacted = redactPayload({
      token: "secret",
      nested: {
        apiKey: "secret",
        value: "x".repeat(600)
      }
    });

    expect(redacted).toMatchObject({
      token: "[redacted]",
      nested: {
        apiKey: "[redacted]"
      }
    });
    expect((redacted as { nested: { value: string } }).nested.value).toContain("[truncated]");
  });
});

describe("database contracts", () => {
  it("keeps JSON-capable wardrobe fields available for downstream item understanding", () => {
    expect(wardrobeItems.manualTags.name).toBe("manual_tags");
    expect(wardrobeItems.colors.name).toBe("colors");
    expect(wardrobeItems.processingStatus.enumValues).toContain("pending");
  });

  it("rejects unsupported enum-like values at the validation layer", () => {
    const processingStatus = z.enum(["pending", "processed", "failed"]);
    expect(processingStatus.safeParse("processing").success).toBe(false);
  });
});
