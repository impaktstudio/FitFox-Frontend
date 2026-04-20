import { routeHandler } from "@/lib/api/handler";
import { resolveAuthContext } from "@/lib/auth/server";
import { evaluateFeatureFlags } from "@/lib/feature-flags/server";
import { captureAnalyticsEvent } from "@/lib/observability/analytics";

export const runtime = "nodejs";

export const GET = routeHandler(async (request) => {
  const auth = resolveAuthContext(request);
  const evaluated = await evaluateFeatureFlags(auth.userId);

  await captureAnalyticsEvent("feature_flags_evaluated", auth.userId, {
    auth_mode: auth.mode,
    source: evaluated.source,
    fallback_reason: "fallbackReason" in evaluated ? evaluated.fallbackReason : undefined
  });

  return {
    userId: auth.userId,
    authMode: auth.mode,
    ...evaluated
  };
});
