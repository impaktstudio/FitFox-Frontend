import type { AppEnv } from "@/lib/config/env";
import type { FeatureFlagMap } from "@/lib/feature-flags/types";

export function getEnvFeatureFlagDefaults(env: AppEnv): FeatureFlagMap {
  return {
    "backend-use-local-processing": env.FEATURE_BACKEND_USE_LOCAL_PROCESSING,
    "backend-use-gpu-worker": env.FEATURE_BACKEND_USE_GPU_WORKER,
    "backend-use-qdrant-sparse": env.FEATURE_BACKEND_USE_QDRANT_SPARSE,
    "backend-use-openrouter": env.FEATURE_BACKEND_USE_OPENROUTER,
    "backend-use-mastra-workflow": env.FEATURE_BACKEND_USE_MASTRA_WORKFLOW,
    "billing-stripe-enabled": env.FEATURE_BILLING_STRIPE_ENABLED
  };
}
