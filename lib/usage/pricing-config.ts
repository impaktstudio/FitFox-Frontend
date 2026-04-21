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

export const defaultUsagePricing: UsagePricingConfig = {
  standardPriceCap: 0.6,
  premiumPriceCap: 3,
  embeddingsUnitCostUsd: 0.00002,
  llmUnitCostUsd: 0.002,
  gpuWorkerTimeUnitCostUsd: 0.05
};

export const pricingFlagKeys = Object.keys(defaultUsagePricing) as (keyof UsagePricingConfig)[];

function coercePositiveNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function coerceUsagePricing(values: Record<string, unknown>): UsagePricingConfig {
  return Object.fromEntries(
    pricingFlagKeys.map((key) => [key, coercePositiveNumber(values[key], defaultUsagePricing[key])] as const)
  ) as UsagePricingConfig;
}
