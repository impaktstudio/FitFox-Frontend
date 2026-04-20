import { routeHandler } from "@/lib/api/handler";
import { resolveAuthContext } from "@/lib/auth/server";
import { evaluateFeatureFlags } from "@/lib/feature-flags/server";

export const runtime = "nodejs";

export const GET = routeHandler(async (request) => {
  const auth = resolveAuthContext(request);
  const evaluated = await evaluateFeatureFlags(auth.userId);

  return {
    userId: auth.userId,
    authMode: auth.mode,
    ...evaluated
  };
});
