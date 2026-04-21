import { routeHandler } from "@/lib/api/handler";
import { resolveAuthContext } from "@/lib/auth/server";
import { evaluateRuntimeConfig } from "@/lib/feature-flags/runtime-config";

export const runtime = "nodejs";

export const GET = routeHandler(async (request) => {
  const auth = await resolveAuthContext(request);
  const evaluated = await evaluateRuntimeConfig(auth.userId);

  return {
    userId: auth.userId,
    authMode: auth.mode,
    ...evaluated
  };
});
