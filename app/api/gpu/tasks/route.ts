import { routeHandler } from "@/lib/api/handler";
import { checkRateLimit, gpuRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { resolveAuthContext } from "@/lib/auth/server";
import { enqueueGpuWorkerTask, gpuWorkerTaskRequestSchema } from "@/lib/gpu-worker/tasks";

export const runtime = "nodejs";

export const POST = routeHandler(async (request, { requestId }) => {
  const auth = await resolveAuthContext(request);

  const rateLimit = checkRateLimit(`gpu:tasks:${auth.userId}`, gpuRateLimit);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const body = await parseJsonBody(request, gpuWorkerTaskRequestSchema);

  return enqueueGpuWorkerTask({
    ...body,
    userId: auth.userId,
    requestId
  });
});
