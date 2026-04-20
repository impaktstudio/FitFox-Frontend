import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { routeHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/validation";
import { getEnv } from "@/lib/config/env";
import { completeTaskUsage } from "@/lib/usage/accounting";

export const runtime = "nodejs";

const workerResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  resultId: z.string().min(1).max(200),
  failureDetails: z.record(z.string(), z.unknown()).optional()
});

function workerSecretFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.headers.get("x-gpu-worker-secret");
}

export const POST = routeHandler<{ taskId: string; status: "succeeded" | "failed"; duplicate: boolean }, {
  taskId?: string | string[];
}>(async (request, { params }) => {
  const env = getEnv();

  if (!env.GPU_WORKER_CALLBACK_SECRET) {
    throw new ApiError("provider_unavailable", "GPU worker callback secret is not configured.", {
      provider: "gpu_backend"
    });
  }

  if (workerSecretFromRequest(request) !== env.GPU_WORKER_CALLBACK_SECRET) {
    throw new ApiError("auth_required", "GPU worker callback secret is invalid.");
  }

  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!taskId) {
    throw new ApiError("bad_request", "GPU task id is required.");
  }

  const body = await parseJsonBody(request, workerResultSchema);
  return completeTaskUsage({
    taskId,
    status: body.status,
    workerResultId: body.resultId,
    failureDetails: body.failureDetails
  });
});
