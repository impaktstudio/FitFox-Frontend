import { routeHandler } from "@/lib/api/handler";
import { getEnv } from "@/lib/config/env";

export const runtime = "nodejs";

export const GET = routeHandler(() => {
  const env = getEnv();

  return {
    service: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.APP_ENV,
    status: "ok"
  };
});
