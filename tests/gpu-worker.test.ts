import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  createGpuWorkerTaskEvent,
  enqueueGpuWorkerTask,
  gpuWorkerTaskRequestedEvent
} from "@/lib/gpu-worker/tasks";
import { defaultOpenRouterModelConfig } from "@/lib/openrouter/default-model";
import type { UsageAccountingStore, UsageReservationResult, WorkerCompletionResult } from "@/lib/usage/accounting";

const taskInput = {
  taskType: "look.render",
  payload: { lookId: "look_123" },
  usageUnits: { embeddings: 100, llm: 1, gpuWorkerTime: 2 },
  idempotencyKey: "task_123",
  userId: "00000000-0000-4000-8000-000000000001",
  requestId: "req_123"
};

function createUsageStore(overrides: Partial<UsageAccountingStore> = {}): UsageAccountingStore {
  const reservations = new Map<string, UsageReservationResult>();
  const taskUsers = new Map<string, string>();

  return {
    async getProfileBillingState() {
      return {
        status: "active",
        currentPeriodEnd: "2027-01-01T00:00:00.000Z",
        metadata: {}
      };
    },
    async reserveUsage(input) {
      taskUsers.set(input.taskId, input.userId);

      const existing = reservations.get(input.taskId);
      if (existing) {
        return {
          ...existing,
          duplicate: true
        };
      }

      const result: UsageReservationResult = {
        taskId: input.taskId,
        status: "reserved",
        duplicate: false,
        reservations: input.costs.map((cost) => ({
          bucket: cost.bucket,
          costUsd: cost.costUsd,
          status: "reserved"
        })),
        remainingUsdByBucket: Object.fromEntries(input.costs.map((cost) => [cost.bucket, input.capUsd - cost.costUsd]))
      };
      reservations.set(input.taskId, result);

      return result;
    },
    async markTaskQueued(taskId) {
      const existing = reservations.get(taskId);
      if (existing) {
        reservations.set(taskId, {
          ...existing,
          status: "queued"
        });
      }
    },
    async getTaskUserId(taskId) {
      return taskUsers.get(taskId) ?? null;
    },
    async completeTask(input): Promise<WorkerCompletionResult> {
      const existing = reservations.get(input.taskId);
      if (!existing) {
        throw new Error("Missing reservation");
      }

      reservations.set(input.taskId, {
        ...existing,
        status: input.status,
        reservations: existing.reservations.map((reservation) => ({
          ...reservation,
          status: input.status === "succeeded" ? "consumed" : "released"
        }))
      });

      return {
        taskId: input.taskId,
        status: input.status,
        duplicate: false
      };
    },
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GPU worker Inngest tasks", () => {
  it("builds a durable task event with the default OpenRouter model config", () => {
    const event = createGpuWorkerTaskEvent(taskInput);

    expect(event).toMatchObject({
      id: "gpu-task:task_123",
      name: gpuWorkerTaskRequestedEvent,
      data: {
        taskId: "task_123",
        taskType: "look.render",
        userId: taskInput.userId,
        requestId: "req_123",
        payload: { lookId: "look_123" },
        modelConfig: defaultOpenRouterModelConfig
      }
    });
    expect(event.data.modelConfig).toEqual({
      model: "moonshotai/kimi-k2.5",
      provider: {
        only: ["Fireworks"]
      }
    });
    expect(event.data.usageUnits).toEqual({ embeddings: 100, llm: 1, gpuWorkerTime: 2 });
  });

  it("sends GPU worker tasks through Inngest in dev mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "true");

    const send = vi.fn(async () => ({ ids: ["evt_123"] }));
    const usageStore = createUsageStore();
    const result = await enqueueGpuWorkerTask(taskInput, { send }, usageStore);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ name: gpuWorkerTaskRequestedEvent }));
    expect(result).toMatchObject({
      taskId: "task_123",
      eventName: gpuWorkerTaskRequestedEvent,
      eventIds: ["evt_123"],
      status: "queued",
      modelConfig: defaultOpenRouterModelConfig,
      duplicate: false,
      capTier: "standard",
      capUsd: 0.6
    });
    expect(result.usageReservations.map((reservation) => reservation.bucket)).toEqual([
      "embeddings",
      "llm",
      "gpu_worker_time"
    ]);
  });

  it("does not dispatch duplicate idempotent tasks twice", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "true");

    const send = vi.fn(async () => ({ ids: ["evt_123"] }));
    const usageStore = createUsageStore();

    await enqueueGpuWorkerTask(taskInput, { send }, usageStore);
    const duplicate = await enqueueGpuWorkerTask(taskInput, { send }, usageStore);

    expect(send).toHaveBeenCalledTimes(1);
    expect(duplicate).toMatchObject({
      taskId: "task_123",
      duplicate: true,
      eventIds: []
    });
  });

  it("releases reserved usage when dispatch fails", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "true");

    const completeTask = vi.fn(async (input: Parameters<UsageAccountingStore["completeTask"]>[0]) => ({
      taskId: input.taskId,
      status: input.status,
      duplicate: false
    }));
    const usageStore = createUsageStore({ completeTask });
    const send = vi.fn(async () => {
      throw new Error("Inngest unavailable");
    });

    await expect(enqueueGpuWorkerTask(taskInput, { send }, usageStore)).rejects.toThrow("Inngest unavailable");
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task_123",
        status: "failed"
      })
    );
  });

  it("requires Inngest configuration before enqueueing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "false");
    vi.stubEnv("INNGEST_EVENT_KEY", "");

    await expect(enqueueGpuWorkerTask(taskInput, { send: vi.fn() }, createUsageStore())).rejects.toThrow(ApiError);
  });
});
