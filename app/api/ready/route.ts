import { routeHandler } from "@/lib/api/handler";
import { getEnv, getProviderReadiness } from "@/lib/config/env";

export const runtime = "nodejs";

export const GET = routeHandler(() => {
  const env = getEnv();
  const providers = getProviderReadiness(env);
  const degraded = providers.some((p) => p.status === "failed");

  return {
    service: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.APP_ENV,
    status: degraded ? "degraded" : "ok"
  };
});
