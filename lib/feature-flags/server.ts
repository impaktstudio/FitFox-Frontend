import type { PostHog } from "posthog-node";
import type { AppEnv } from "@/lib/config/env";
import { getEnv, isLocalLike } from "@/lib/config/env";
import { defaultFeatureFlags } from "@/lib/feature-flags/defaults";
import { featureFlagKeys, type EvaluatedFeatureFlags, type FeatureFlagMap } from "@/lib/feature-flags/types";
import { getPostHogClient } from "@/lib/feature-flags/posthog";

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

export async function evaluateFeatureFlags(
  userId: string,
  options: {
    env?: AppEnv;
    posthog?: Pick<PostHog, "getFeatureFlag"> | null;
  } = {}
): Promise<EvaluatedFeatureFlags> {
  const env = options.env ?? getEnv();
  const posthog = options.posthog ?? getPostHogClient(env);

  if (!posthog) {
    return {
      flags: defaultFeatureFlags,
      source: "default_fallback",
      fallbackReason: isLocalLike(env) ? "PostHog disabled in local/test mode" : "PostHog is not configured"
    };
  }

  try {
    const entries = await Promise.all(
      featureFlagKeys.map(async (key) => {
        const value = await posthog.getFeatureFlag(key, userId);
        return [key, coercePostHogFlag(value, defaultFeatureFlags[key])] as const;
      })
    );

    return {
      flags: Object.fromEntries(entries) as FeatureFlagMap,
      source: "posthog"
    };
  } catch (error) {
    return {
      flags: defaultFeatureFlags,
      source: "default_fallback",
      fallbackReason: error instanceof Error ? error.message : "PostHog feature flag evaluation failed"
    };
  }
}
