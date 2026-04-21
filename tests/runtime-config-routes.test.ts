import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as featureFlagsGET } from "@/app/api/feature-flags/route";
import { GET as healthGET } from "@/app/api/health/route";

const analytics = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn()
}));

vi.mock("@/lib/observability/analytics", () => analytics);

const baseEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  POSTHOG_DISABLED: "true"
} as const;

function stubBaseEnv(): void {
  for (const [key, value] of Object.entries(baseEnv)) {
    vi.stubEnv(key, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  analytics.captureAnalyticsEvent.mockClear();
});

describe("runtime config routes", () => {
  it("returns feature flags and usage pricing from the diagnostic endpoint", async () => {
    stubBaseEnv();

    const response = await featureFlagsGET(new NextRequest("https://fitfox.test/api/feature-flags"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      userId: baseEnv.TEST_AUTH_USER_ID,
      authMode: "test",
      source: "default_fallback",
      flags: {
        "backend-use-local-processing": true,
        "backend-use-openrouter": false
      },
      usagePricing: {
        source: "default_fallback",
        pricing: {
          standardPriceCap: 0.6,
          premiumPriceCap: 3
        }
      }
    });
  });

  it("does not emit analytics from health checks", async () => {
    stubBaseEnv();

    const response = await healthGET(new NextRequest("https://fitfox.test/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(analytics.captureAnalyticsEvent).not.toHaveBeenCalled();
  });
});
