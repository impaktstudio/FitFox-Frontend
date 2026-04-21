import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "@/lib/config/env";
import { evaluateFeatureFlags } from "@/lib/feature-flags/server";
import { evaluateRuntimeConfig } from "@/lib/feature-flags/runtime-config";

const env = parseEnv({
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  POSTHOG_DISABLED: "false",
  POSTHOG_API_KEY: "ph_test"
});

describe("feature flags", () => {
  it("uses one batched PostHog call when configured", async () => {
    const posthog = {
      getAllFlags: vi.fn(async () => ({
        "backend-use-openrouter": true,
        "backend-use-local-processing": false,
        standardPriceCap: "0.75"
      })),
      getFeatureFlag: vi.fn()
    };

    const evaluated = await evaluateRuntimeConfig("user_1", {
      env,
      posthog
    });

    expect(evaluated.source).toBe("posthog");
    expect(evaluated.flags["backend-use-openrouter"]).toBe(true);
    expect(evaluated.flags["backend-use-local-processing"]).toBe(false);
    expect(evaluated.usagePricing.pricing.standardPriceCap).toBe(0.75);
    expect(posthog.getAllFlags).toHaveBeenCalledTimes(1);
    expect(posthog.getAllFlags).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        flagKeys: expect.arrayContaining(["backend-use-openrouter", "standardPriceCap"])
      })
    );
    expect(posthog.getFeatureFlag).not.toHaveBeenCalled();
  });

  it("keeps the feature flag wrapper compatible", async () => {
    const evaluated = await evaluateFeatureFlags("user_1", {
      env,
      posthog: {
        getAllFlags: async () => ({
          "backend-use-openrouter": true,
          "backend-use-local-processing": false
        })
      }
    });

    expect(evaluated.source).toBe("posthog");
    expect(evaluated.flags["backend-use-openrouter"]).toBe(true);
    expect(evaluated.flags["backend-use-local-processing"]).toBe(false);
  });

  it("falls back to default flag values when PostHog is unavailable", async () => {
    const evaluated = await evaluateFeatureFlags("user_1", {
      env,
      posthog: {
        getAllFlags: async () => {
          throw new Error("network down");
        }
      }
    });

    expect(evaluated.source).toBe("default_fallback");
    expect(evaluated.flags["backend-use-local-processing"]).toBe(true);
    expect(evaluated.flags["backend-use-openrouter"]).toBe(false);
    expect(evaluated.fallbackReason).toContain("network down");
  });

  it("uses default flag values when PostHog is not configured", async () => {
    const evaluated = await evaluateFeatureFlags("user_1", {
      env: parseEnv({
        NODE_ENV: "test",
        APP_ENV: "test",
        AUTH_MODE: "test",
        TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
        POSTHOG_DISABLED: "true"
      })
    });

    expect(evaluated.source).toBe("default_fallback");
    expect(evaluated.flags).toEqual({
      "backend-use-local-processing": true,
      "backend-use-gpu-worker": false,
      "backend-use-qdrant-sparse": false,
      "backend-use-openrouter": false,
      "backend-use-mastra-workflow": false,
      "billing-stripe-enabled": false
    });
  });
});
