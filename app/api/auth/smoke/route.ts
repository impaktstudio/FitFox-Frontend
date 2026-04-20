import { routeHandler } from "@/lib/api/handler";
import { resolveAuthContext } from "@/lib/auth/server";
import { captureAnalyticsEvent } from "@/lib/observability/analytics";

export const runtime = "nodejs";

export const GET = routeHandler(async (request) => {
  const auth = resolveAuthContext(request);

  await captureAnalyticsEvent("auth_smoke_tested", auth.userId, {
    auth_mode: auth.mode,
    auth_source: auth.source
  });

  return {
    authenticated: true,
    auth
  };
});
