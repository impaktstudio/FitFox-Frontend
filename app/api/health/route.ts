import { routeHandler } from "@/lib/api/handler";
import { getEnv } from "@/lib/config/env";
import { captureAnalyticsEvent } from "@/lib/observability/analytics";

export const runtime = "nodejs";

export const GET = routeHandler(async () => {
  const env = getEnv();

  await captureAnalyticsEvent("epic1_foundation_event", "system", {
    service: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.APP_ENV
  });

  return {
    service: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.APP_ENV,
    status: "ok"
  };
});
