import type { AppEnv } from "@/lib/config/env";
import { evaluateRuntimeConfig, type RuntimeConfigPostHog } from "@/lib/feature-flags/runtime-config";
import {
  defaultUsagePricing,
  type UsagePricingConfig,
  type UsagePricingEvaluation
} from "@/lib/usage/pricing-config";

export type { UsagePricingConfig, UsagePricingEvaluation } from "@/lib/usage/pricing-config";

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

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export async function evaluateUsagePricing(
  userId: string,
  options: {
    env?: AppEnv;
    posthog?: RuntimeConfigPostHog | null;
    trackExposure?: boolean;
  } = {}
): Promise<UsagePricingEvaluation> {
  const evaluated = await evaluateRuntimeConfig(userId, options);

  return evaluated.usagePricing;
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
