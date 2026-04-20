import type { PostHog } from "posthog-node";
import type { AppEnv } from "@/lib/config/env";
import { getEnv, isLocalLike } from "@/lib/config/env";
import { getPostHogClient } from "@/lib/feature-flags/posthog";

export const usageBuckets = ["embeddings", "llm", "gpu_worker_time"] as const;

export type UsageBucket = (typeof usageBuckets)[number];

export type UsageUnitInput = {
  embeddings?: number;
  llm?: number;
  gpuWorkerTime?: number;
};

export type UsageCost = {
  bucket: UsageBucket;
  units: number;
  unitCostUsd: number;
  costUsd: number;
};

export type UsagePricingConfig = {
  standardPriceCap: number;
  premiumPriceCap: number;
  embeddingsUnitCostUsd: number;
  llmUnitCostUsd: number;
  gpuWorkerTimeUnitCostUsd: number;
};

export type UsagePricingEvaluation = {
  pricing: UsagePricingConfig;
  source: "posthog" | "default_fallback";
  fallbackReason?: string;
};

const defaultUsagePricing: UsagePricingConfig = {
  standardPriceCap: 0.6,
  premiumPriceCap: 3,
  embeddingsUnitCostUsd: 0.00002,
  llmUnitCostUsd: 0.002,
  gpuWorkerTimeUnitCostUsd: 0.05
};

const pricingFlagKeys = Object.keys(defaultUsagePricing) as (keyof UsagePricingConfig)[];

function coercePositiveNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export async function evaluateUsagePricing(
  userId: string,
  options: {
    env?: AppEnv;
    posthog?: Pick<PostHog, "getFeatureFlag"> | null;
  } = {}
): Promise<UsagePricingEvaluation> {
  const env = options.env ?? getEnv();
  const posthog = options.posthog ?? getPostHogClient(env);

  if (!posthog) {
    return {
      pricing: defaultUsagePricing,
      source: "default_fallback",
      fallbackReason: isLocalLike(env) ? "PostHog disabled in local/test mode" : "PostHog is not configured"
    };
  }

  try {
    const entries = await Promise.all(
      pricingFlagKeys.map(async (key) => {
        const value = await posthog.getFeatureFlag(key, userId);
        return [key, coercePositiveNumber(value, defaultUsagePricing[key])] as const;
      })
    );

    return {
      pricing: Object.fromEntries(entries) as UsagePricingConfig,
      source: "posthog"
    };
  } catch (error) {
    return {
      pricing: defaultUsagePricing,
      source: "default_fallback",
      fallbackReason: error instanceof Error ? error.message : "PostHog pricing flag evaluation failed"
    };
  }
}

export function capTierFromMetadata(metadata: Record<string, unknown> | null | undefined): "standard" | "premium" {
  return metadata?.capTier === "premium" ? "premium" : "standard";
}

export function priceCapForTier(pricing: UsagePricingConfig, tier: "standard" | "premium"): number {
  return tier === "premium" ? pricing.premiumPriceCap : pricing.standardPriceCap;
}

export function estimateUsageCosts(units: UsageUnitInput | undefined, pricing: UsagePricingConfig): UsageCost[] {
  const safeUnits = {
    embeddings: Math.max(0, units?.embeddings ?? 0),
    llm: Math.max(0, units?.llm ?? 0),
    gpuWorkerTime: Math.max(0, units?.gpuWorkerTime ?? 1)
  };

  const costs: UsageCost[] = [
    {
      bucket: "embeddings",
      units: safeUnits.embeddings,
      unitCostUsd: pricing.embeddingsUnitCostUsd,
      costUsd: roundUsd(safeUnits.embeddings * pricing.embeddingsUnitCostUsd)
    },
    {
      bucket: "llm",
      units: safeUnits.llm,
      unitCostUsd: pricing.llmUnitCostUsd,
      costUsd: roundUsd(safeUnits.llm * pricing.llmUnitCostUsd)
    },
    {
      bucket: "gpu_worker_time",
      units: safeUnits.gpuWorkerTime,
      unitCostUsd: pricing.gpuWorkerTimeUnitCostUsd,
      costUsd: roundUsd(safeUnits.gpuWorkerTime * pricing.gpuWorkerTimeUnitCostUsd)
    }
  ];

  return costs.filter((cost) => cost.costUsd > 0);
}

export function defaultPricingForTests(): UsagePricingConfig {
  return defaultUsagePricing;
}
