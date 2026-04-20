import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getEnv, isLocalLike } from "@/lib/config/env";
import { inngest } from "@/lib/inngest/client";
import { defaultOpenRouterModelConfig } from "@/lib/openrouter/default-model";
import {
  createSupabaseUsageAccountingStore,
  reserveTaskUsage,
  type UsageAccountingStore,
  type UsageReservation
} from "@/lib/usage/accounting";

export const gpuWorkerTaskRequestedEvent = "fitfox/gpu.task.requested" as const;

const taskName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._/-]*$/);

export const gpuWorkerTaskRequestSchema = z.object({
  taskType: taskName,
  payload: z.record(z.string(), z.unknown()).default({}),
  usageUnits: z
    .object({
      embeddings: z.number().min(0).finite().optional(),
      llm: z.number().min(0).finite().optional(),
      gpuWorkerTime: z.number().min(0).finite().optional()
    })
    .optional(),
  idempotencyKey: z.string().min(1).max(200).optional()
});

export type GpuWorkerTaskRequest = z.infer<typeof gpuWorkerTaskRequestSchema>;

export type GpuWorkerTaskEventData = {
  taskId: string;
  taskType: string;
  userId: string;
  requestId: string;
  payload: Record<string, unknown>;
  usageUnits?: GpuWorkerTaskRequest["usageUnits"];
  modelConfig: typeof defaultOpenRouterModelConfig;
  submittedAt: string;
};

export type GpuWorkerTaskEvent = {
  id: string;
  name: typeof gpuWorkerTaskRequestedEvent;
  data: GpuWorkerTaskEventData;
};

type InngestEventSender = {
  send: (event: GpuWorkerTaskEvent) => Promise<{ ids: string[] }>;
};

export type EnqueueGpuWorkerTaskInput = GpuWorkerTaskRequest & {
  userId: string;
  requestId: string;
};

export type EnqueueGpuWorkerTaskResult = {
  taskId: string;
  eventName: typeof gpuWorkerTaskRequestedEvent;
  eventIds: string[];
  status: "queued";
  modelConfig: typeof defaultOpenRouterModelConfig;
  usageReservations: UsageReservation[];
  remainingUsdByBucket: Record<string, number>;
  capUsd: number;
  capTier: "standard" | "premium";
  duplicate: boolean;
};

function createTaskId(input: Pick<EnqueueGpuWorkerTaskInput, "idempotencyKey" | "requestId">): string {
  return input.idempotencyKey ?? input.requestId;
}

export function createGpuWorkerTaskEvent(input: EnqueueGpuWorkerTaskInput): GpuWorkerTaskEvent {
  const taskId = createTaskId(input);

  return {
    id: `gpu-task:${taskId}`,
    name: gpuWorkerTaskRequestedEvent,
    data: {
      taskId,
      taskType: input.taskType,
      userId: input.userId,
      requestId: input.requestId,
      payload: input.payload,
      usageUnits: input.usageUnits,
      modelConfig: defaultOpenRouterModelConfig,
      submittedAt: new Date().toISOString()
    }
  };
}

export async function enqueueGpuWorkerTask(
  input: EnqueueGpuWorkerTaskInput,
  sender: InngestEventSender = inngest,
  usageStore: UsageAccountingStore = createSupabaseUsageAccountingStore()
): Promise<EnqueueGpuWorkerTaskResult> {
  const env = getEnv();

  if (!env.INNGEST_EVENT_KEY && !env.INNGEST_DEV) {
    const message = isLocalLike(env)
      ? "INNGEST_EVENT_KEY or INNGEST_DEV=true is required to enqueue GPU worker tasks."
      : "INNGEST_EVENT_KEY is required to enqueue GPU worker tasks.";
    throw new ApiError("provider_unavailable", message, { provider: "inngest" });
  }

  const event = createGpuWorkerTaskEvent(input);
  const usage = await reserveTaskUsage({
    taskId: event.data.taskId,
    userId: input.userId,
    taskType: input.taskType,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    usageUnits: input.usageUnits,
    store: usageStore
  });

  if (usage.duplicate) {
    return {
      taskId: event.data.taskId,
      eventName: event.name,
      eventIds: [],
      status: "queued",
      modelConfig: event.data.modelConfig,
      usageReservations: usage.reservations,
      remainingUsdByBucket: usage.remainingUsdByBucket,
      capUsd: usage.capUsd,
      capTier: usage.capTier,
      duplicate: true
    };
  }

  let result: { ids: string[] };
  try {
    result = await sender.send(event);
    await usageStore.markTaskQueued(event.data.taskId, input.userId);
  } catch (error) {
    await usageStore.completeTask({
      taskId: event.data.taskId,
      userId: input.userId,
      status: "failed",
      workerResultId: `dispatch-failed:${event.data.taskId}`,
      failureDetails: {
        stage: "dispatch",
        message: error instanceof Error ? error.message : "GPU task dispatch failed"
      }
    });
    throw error;
  }

  return {
    taskId: event.data.taskId,
    eventName: event.name,
    eventIds: result.ids,
    status: "queued",
    modelConfig: event.data.modelConfig,
    usageReservations: usage.reservations,
    remainingUsdByBucket: usage.remainingUsdByBucket,
    capUsd: usage.capUsd,
    capTier: usage.capTier,
    duplicate: false
  };
}
