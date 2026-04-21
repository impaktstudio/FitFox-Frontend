import { authFailure, signOutResponse } from "@/lib/auth/api";
import { authRateLimit, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`auth:signout:${getClientIp(request)}`, authRateLimit);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    await supabase.auth.signOut();

    return signOutResponse(request);
  } catch (error) {
    return authFailure(request, error);
  }
}
