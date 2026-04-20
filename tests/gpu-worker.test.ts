import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  createGpuWorkerTaskEvent,
  enqueueGpuWorkerTask,
  gpuWorkerTaskRequestedEvent
} from "@/lib/gpu-worker/tasks";
import { defaultOpenRouterModelConfig } from "@/lib/openrouter/default-model";

const taskInput = {
  taskType: "look.render",
  payload: { lookId: "look_123" },
  idempotencyKey: "task_123",
  userId: "00000000-0000-4000-8000-000000000001",
  requestId: "req_123"
};

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
  });

  it("sends GPU worker tasks through Inngest in dev mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "true");

    const send = vi.fn(async () => ({ ids: ["evt_123"] }));
    const result = await enqueueGpuWorkerTask(taskInput, { send });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ name: gpuWorkerTaskRequestedEvent }));
    expect(result).toEqual({
      taskId: "task_123",
      eventName: gpuWorkerTaskRequestedEvent,
      eventIds: ["evt_123"],
      status: "queued",
      modelConfig: defaultOpenRouterModelConfig
    });
  });

  it("requires Inngest configuration before enqueueing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("INNGEST_DEV", "false");
    vi.stubEnv("INNGEST_EVENT_KEY", "");

    await expect(enqueueGpuWorkerTask(taskInput, { send: vi.fn() })).rejects.toThrow(ApiError);
  });
});
