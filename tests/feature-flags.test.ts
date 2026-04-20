import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config/env";
import { evaluateFeatureFlags } from "@/lib/feature-flags/server";

const env = parseEnv({
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  POSTHOG_DISABLED: "false",
  POSTHOG_API_KEY: "ph_test",
  FEATURE_BACKEND_USE_LOCAL_PROCESSING: "true",
  FEATURE_BACKEND_USE_VERTEX_AI: "false"
});

describe("feature flags", () => {
  it("uses PostHog values when configured", async () => {
    const evaluated = await evaluateFeatureFlags("user_1", {
      env,
      posthog: {
        getFeatureFlag: async (key) => key === "backend-use-vertex-ai"
      }
    });

    expect(evaluated.source).toBe("posthog");
    expect(evaluated.flags["backend-use-vertex-ai"]).toBe(true);
    expect(evaluated.flags["backend-use-local-processing"]).toBe(false);
  });

  it("falls back to env defaults when PostHog is unavailable", async () => {
    const evaluated = await evaluateFeatureFlags("user_1", {
      env,
      posthog: {
        getFeatureFlag: async () => {
          throw new Error("network down");
        }
      }
    });

    expect(evaluated.source).toBe("env_fallback");
    expect(evaluated.flags["backend-use-local-processing"]).toBe(true);
    expect(evaluated.flags["backend-use-vertex-ai"]).toBe(false);
    expect(evaluated.fallbackReason).toContain("network down");
  });
});
