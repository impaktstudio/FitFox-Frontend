import { routeHandler } from "@/lib/api/handler";
import { resolveAuthContext } from "@/lib/auth/server";

export const runtime = "nodejs";

export const GET = routeHandler((request) => {
  const auth = resolveAuthContext(request);

  return {
    authenticated: true,
    auth
  };
});
