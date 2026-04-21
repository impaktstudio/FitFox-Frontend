import {
  estimateUsageCosts,
  type UsageCost,
  type UsagePricingConfig,
  type UsageUnitInput
} from "@/lib/usage/pricing";

export type UsageContextSource = "gpu_task_type" | "conservative_fallback";

export type UsageContext = {
  taskType: string;
  source: UsageContextSource;
  units: UsageUnitInput;
};

const gpuUsageUnitsByTaskType: Record<string, UsageUnitInput> = {
  "look.render": {
    embeddings: 100,
    llm: 1,
    gpuWorkerTime: 2
  },
  "image.generate": {
    llm: 1,
    gpuWorkerTime: 4
  },
  "image.segment": {
    gpuWorkerTime: 2
  },
  "splade.index": {
    embeddings: 250,
    gpuWorkerTime: 1
  }
};

const conservativeGpuUsageUnits: UsageUnitInput = {
  embeddings: 100,
  llm: 1,
  gpuWorkerTime: 2
};

export function resolveGpuUsageContext(input: {
  taskType: string;
  payload: Record<string, unknown>;
}): UsageContext {
  const units = gpuUsageUnitsByTaskType[input.taskType];

  if (units) {
    return {
      taskType: input.taskType,
      source: "gpu_task_type",
      units
    };
  }

  return {
    taskType: input.taskType,
    source: "conservative_fallback",
    units: conservativeGpuUsageUnits
  };
}

export function estimateUsageCostsForContext(
  context: UsageContext,
  pricing: UsagePricingConfig
): UsageCost[] {
  return estimateUsageCosts(context.units, pricing);
}
