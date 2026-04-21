import { ApiError } from "@/lib/api/errors";
import { authFailure, authResponse, authUserPayload, parseAuthPayload } from "@/lib/auth/api";
import { authEmailRateLimit, authRateLimit, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`auth:signin:${getClientIp(request)}`, authRateLimit);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    const payload = await parseAuthPayload(request);

    const emailRateLimit = checkRateLimit(`auth:signin:email:${payload.email.toLowerCase()}`, authEmailRateLimit);
    if (!emailRateLimit.allowed) {
      return rateLimitResponse(emailRateLimit.resetAt);
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (error) {
      console.warn("Supabase signIn error", { email: payload.email, message: error.message, code: error.code });
      throw new ApiError("auth_required", "Invalid credentials or account already exists.");
    }

    if (!data.user || !data.session) {
      throw new ApiError("auth_required", "Supabase did not return a session.");
    }

    return authResponse(
      request,
      {
        user: authUserPayload(data.user)
      },
      data.session
    );
  } catch (error) {
    return authFailure(request, error);
  }
}
