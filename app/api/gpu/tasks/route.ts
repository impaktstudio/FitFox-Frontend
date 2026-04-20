import { routeHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/validation";
import { resolveAuthContext } from "@/lib/auth/server";
import { enqueueGpuWorkerTask, gpuWorkerTaskRequestSchema } from "@/lib/gpu-worker/tasks";

export const runtime = "nodejs";

export const POST = routeHandler(async (request, { requestId }) => {
  const auth = await resolveAuthContext(request);
  const body = await parseJsonBody(request, gpuWorkerTaskRequestSchema);

  return enqueueGpuWorkerTask({
    ...body,
    userId: auth.userId,
    requestId
  });
});
