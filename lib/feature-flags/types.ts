export const featureFlagKeys = [
  "backend-use-local-processing",
  "backend-use-gpu-worker",
  "backend-use-qdrant-sparse",
  "backend-use-vertex-ai",
  "backend-use-mastra-workflow",
  "billing-stripe-enabled"
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];

export type FeatureFlagMap = Record<FeatureFlagKey, boolean>;

export type FeatureFlagSource = "posthog" | "env_fallback";

export type EvaluatedFeatureFlags = {
  flags: FeatureFlagMap;
  source: FeatureFlagSource;
  fallbackReason?: string;
};
