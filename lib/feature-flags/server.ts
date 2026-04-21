import type { AppEnv } from "@/lib/config/env";
import type { EvaluatedFeatureFlags } from "@/lib/feature-flags/types";
import { evaluateRuntimeConfig, type RuntimeConfigPostHog } from "@/lib/feature-flags/runtime-config";

export async function evaluateFeatureFlags(
  userId: string,
  options: {
    env?: AppEnv;
    posthog?: RuntimeConfigPostHog | null;
    trackExposure?: boolean;
  } = {}
): Promise<EvaluatedFeatureFlags> {
  const evaluated = await evaluateRuntimeConfig(userId, options);

  return {
    flags: evaluated.flags,
    source: evaluated.source,
    fallbackReason: evaluated.fallbackReason
  };
}
