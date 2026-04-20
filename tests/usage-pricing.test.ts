import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { parseEnv } from "@/lib/config/env";
import { assertSubscriptionAllowsUsage, currentWeeklyUsagePeriod } from "@/lib/usage/accounting";
import {
  capTierFromMetadata,
  defaultPricingForTests,
  estimateUsageCosts,
  evaluateUsagePricing,
  priceCapForTier
} from "@/lib/usage/pricing";

const testEnv = parseEnv({
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
  POSTHOG_API_KEY: "test-posthog-key"
});

describe("usage pricing", () => {
  it("uses standard and premium PostHog cap flags", async () => {
    const posthog = {
      getFeatureFlag: vi.fn(async (key: string) => {
        if (key === "standardPriceCap") return "0.75";
        if (key === "premiumPriceCap") return "3.5";
        return false;
      })
    };

    const evaluated = await evaluateUsagePricing("user_123", {
      env: testEnv,
      posthog
    });

    expect(evaluated.source).toBe("posthog");
    expect(evaluated.pricing.standardPriceCap).toBe(0.75);
    expect(evaluated.pricing.premiumPriceCap).toBe(3.5);
  });

  it("falls back to default caps when PostHog is unavailable", async () => {
    const evaluated = await evaluateUsagePricing("user_123", {
      env: {
        ...testEnv,
        POSTHOG_DISABLED: true
      },
      posthog: null
    });

    expect(evaluated.source).toBe("default_fallback");
    expect(evaluated.pricing.standardPriceCap).toBe(0.6);
    expect(evaluated.pricing.premiumPriceCap).toBe(3);
  });

  it("selects standard by default and premium from Stripe metadata", () => {
    const pricing = defaultPricingForTests();

    expect(capTierFromMetadata({})).toBe("standard");
    expect(priceCapForTier(pricing, "standard")).toBe(0.6);
    expect(capTierFromMetadata({ capTier: "premium" })).toBe("premium");
    expect(priceCapForTier(pricing, "premium")).toBe(3);
  });

  it("computes bucket costs from units and PostHog-backed rates", () => {
    const costs = estimateUsageCosts(
      { embeddings: 100, llm: 2, gpuWorkerTime: 3 },
      {
        standardPriceCap: 0.6,
        premiumPriceCap: 3,
        embeddingsUnitCostUsd: 0.001,
        llmUnitCostUsd: 0.01,
        gpuWorkerTimeUnitCostUsd: 0.2
      }
    );

    expect(costs).toEqual([
      { bucket: "embeddings", units: 100, unitCostUsd: 0.001, costUsd: 0.1 },
      { bucket: "llm", units: 2, unitCostUsd: 0.01, costUsd: 0.02 },
      { bucket: "gpu_worker_time", units: 3, unitCostUsd: 0.2, costUsd: 0.6 }
    ]);
  });
});

describe("subscription usage entitlement", () => {
  it("requires active subscriptions inside the current period", () => {
    const now = new Date("2026-04-20T12:00:00.000Z");

    expect(() =>
      assertSubscriptionAllowsUsage(
        {
          status: "active",
          currentPeriodEnd: "2026-04-21T00:00:00.000Z",
          metadata: {}
        },
        now
      )
    ).not.toThrow();

    expect(() =>
      assertSubscriptionAllowsUsage(
        {
          status: "canceled",
          currentPeriodEnd: "2026-04-21T00:00:00.000Z",
          metadata: {}
        },
        now
      )
    ).toThrow(ApiError);

    expect(() =>
      assertSubscriptionAllowsUsage(
        {
          status: "active",
          currentPeriodEnd: "2026-04-20T11:00:00.000Z",
          metadata: {}
        },
        now
      )
    ).toThrow(ApiError);
  });

  it("uses weekly usage periods", () => {
    const period = currentWeeklyUsagePeriod(new Date("2026-04-22T12:00:00.000Z"));

    expect(period.periodStart.toISOString()).toBe("2026-04-19T00:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-04-26T00:00:00.000Z");
  });
});
