import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { routeHandler } from "@/lib/api/handler";
import { authEmailRateLimit, authRateLimit, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { buildAuthCallbackUrl, safeRelativePath } from "@/lib/auth/redirects";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const otpRequestSchema = z.object({
  email: z.email(),
  next: z.string().optional()
});

export const POST = routeHandler(async (request) => {
  const rateLimit = checkRateLimit(`auth:otp:${getClientIp(request)}`, authRateLimit);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const payload = await parseJsonBody(request, otpRequestSchema);
  const email = payload.email.toLowerCase();
  const emailRateLimit = checkRateLimit(`auth:otp:email:${email}`, authEmailRateLimit);
  if (!emailRateLimit.allowed) {
    return rateLimitResponse(emailRateLimit.resetAt);
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const emailRedirectTo = buildAuthCallbackUrl(request, "/auth/confirm", safeRelativePath(payload.next)).toString();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo
    }
  });

  if (error) {
    console.warn("Supabase OTP sign-in error", { email, message: error.message, code: error.code });
    throw new ApiError("provider_unavailable", "Unable to send sign-in link.", {
      provider: "supabase"
    });
  }

  return {
    sent: true
  };
});
