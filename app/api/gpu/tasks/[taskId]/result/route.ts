import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { routeHandler } from "@/lib/api/handler";
import { getEnv } from "@/lib/config/env";
import { verifyGpuWorkerSignature } from "@/lib/gpu-worker/signature";
import { completeTaskUsage } from "@/lib/usage/accounting";

export const runtime = "nodejs";

const workerResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  resultId: z.string().min(1).max(200),
  failureDetails: z.record(z.string(), z.unknown()).optional()
});

export const POST = routeHandler<{ taskId: string; status: "succeeded" | "failed"; duplicate: boolean }, {
  taskId?: string | string[];
}>(async (request, { params }) => {
  const env = getEnv();

  if (!env.GPU_WORKER_CALLBACK_SECRET) {
    throw new ApiError("provider_unavailable", "GPU worker callback secret is not configured.", {
      provider: "gpu_backend"
    });
  }

  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!taskId) {
    throw new ApiError("bad_request", "GPU task id is required.");
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-gpu-worker-signature");
  verifyGpuWorkerSignature(env.GPU_WORKER_CALLBACK_SECRET, taskId, signatureHeader, rawBody);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ApiError("bad_request", "Request body must be valid JSON");
  }

  const parsed = workerResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("validation_failed", "Request validation failed");
  }

  return completeTaskUsage({
    taskId,
    status: parsed.data.status,
    workerResultId: parsed.data.resultId,
    failureDetails: parsed.data.failureDetails
  });
});
