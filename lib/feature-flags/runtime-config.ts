import type { PostHog } from "posthog-node";
import type { AppEnv } from "@/lib/config/env";
import { getEnv, isLocalLike } from "@/lib/config/env";
import { defaultFeatureFlags } from "@/lib/feature-flags/defaults";
import { featureFlagKeys, type FeatureFlagKey, type FeatureFlagMap, type FeatureFlagSource } from "@/lib/feature-flags/types";
import { getPostHogClient } from "@/lib/feature-flags/posthog";
import { coerceUsagePricing, defaultUsagePricing, pricingFlagKeys } from "@/lib/usage/pricing-config";
import type { UsagePricingEvaluation } from "@/lib/usage/pricing-config";

export type RuntimeFlagCategory = "operational" | "experiment";

export const runtimeFlagCategories: Record<FeatureFlagKey, RuntimeFlagCategory> = {
  "backend-use-local-processing": "operational",
  "backend-use-gpu-worker": "operational",
  "backend-use-qdrant-sparse": "operational",
  "backend-use-openrouter": "operational",
  "backend-use-mastra-workflow": "operational",
  "billing-stripe-enabled": "operational"
};

export type RuntimeConfigPostHog = Pick<PostHog, "getAllFlags"> & Partial<Pick<PostHog, "getFeatureFlag">>;

export type RuntimeConfigEvaluation = {
  flags: FeatureFlagMap;
  source: FeatureFlagSource;
  fallbackReason?: string;
  usagePricing: UsagePricingEvaluation;
};

function coercePostHogFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return fallback;
}

function coerceFeatureFlags(values: Record<string, unknown>): FeatureFlagMap {
  return Object.fromEntries(
    featureFlagKeys.map((key) => [key, coercePostHogFlag(values[key], defaultFeatureFlags[key])] as const)
  ) as FeatureFlagMap;
}

function fallbackRuntimeConfig(reason: string): RuntimeConfigEvaluation {
  return {
    flags: defaultFeatureFlags,
    source: "default_fallback",
    fallbackReason: reason,
    usagePricing: {
      pricing: defaultUsagePricing,
      source: "default_fallback",
      fallbackReason: reason
    }
  };
}

async function getRuntimeFlagValues(
  userId: string,
  posthog: RuntimeConfigPostHog,
  trackExposure: boolean
): Promise<Record<string, unknown>> {
  const flagKeys = [...featureFlagKeys, ...pricingFlagKeys];

  if (!trackExposure) {
    return posthog.getAllFlags(userId, { flagKeys });
  }

  if (!posthog.getFeatureFlag) {
    throw new Error("PostHog feature flag exposure tracking is not available");
  }

  const getFeatureFlag = posthog.getFeatureFlag.bind(posthog);
  const entries = await Promise.all(
    flagKeys.map(async (key) => {
      const value = await getFeatureFlag(key, userId, { sendFeatureFlagEvents: true });
      return [key, value] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function evaluateRuntimeConfig(
  userId: string,
  options: {
    env?: AppEnv;
    posthog?: RuntimeConfigPostHog | null;
    trackExposure?: boolean;
  } = {}
): Promise<RuntimeConfigEvaluation> {
  const env = options.env ?? getEnv();
  const posthog = options.posthog ?? getPostHogClient(env);

  if (!posthog) {
    return fallbackRuntimeConfig(
      isLocalLike(env) ? "PostHog disabled in local/test mode" : "PostHog is not configured"
    );
  }

  try {
    const values = await getRuntimeFlagValues(userId, posthog, options.trackExposure ?? false);
    const flags = coerceFeatureFlags(values);
    const pricing = coerceUsagePricing(values);

    return {
      flags,
      source: "posthog",
      usagePricing: {
        pricing,
        source: "posthog"
      }
    };
  } catch (error) {
    return fallbackRuntimeConfig(error instanceof Error ? error.message : "PostHog runtime config evaluation failed");
  }
}
