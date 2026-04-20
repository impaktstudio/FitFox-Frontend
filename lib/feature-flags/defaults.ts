import type { FeatureFlagMap } from "@/lib/feature-flags/types";

export const defaultFeatureFlags: FeatureFlagMap = {
  "backend-use-local-processing": true,
  "backend-use-gpu-worker": false,
  "backend-use-qdrant-sparse": false,
  "backend-use-openrouter": false,
  "backend-use-mastra-workflow": false,
  "billing-stripe-enabled": false
};
