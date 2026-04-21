import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/handler";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { getBillingPlan } from "@/lib/billing/plans";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const authPayloadSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(1).max(120).optional(),
  billingPlanId: z.enum(["trial", "weekly", "monthly", "annually"]).default("trial")
});

const maxBodySizeBytes = 1_048_576; // 1 MB

export async function parseAuthPayload(request: Request): Promise<z.infer<typeof authPayloadSchema>> {
  const text = await request.text();
  const byteLength = new TextEncoder().encode(text).length;

  if (byteLength > maxBodySizeBytes) {
    throw new ApiError("bad_request", "Request body exceeds maximum allowed size.");
  }

  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("bad_request", "Request body must be valid JSON");
  }

  const parsed = authPayloadSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("Auth payload validation failed", z.treeifyError(parsed.error));
    throw new ApiError("validation_failed", "Request validation failed");
  }

  return parsed.data;
}

export function authResponse<T>(request: Request, data: T, session?: { access_token: string; refresh_token: string }) {
  const env = getEnv();
  const response = apiSuccess(data, getRequestId(request));

  if (session) {
    setAuthCookies(response, session, env.APP_ENV !== "local");
  }

  return response;
}

export function signOutResponse(request: Request): NextResponse {
  const response = apiSuccess({ signedOut: true }, getRequestId(request));
  clearAuthCookies(response);

  return response;
}

export function authFailure(request: Request, error: unknown): NextResponse {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof Error
        ? new ApiError("internal_error", error.message)
        : new ApiError("internal_error", "Unexpected server error");

  return apiFailure(apiError, getRequestId(request));
}

export async function upsertSignupProfile(input: {
  userId: string;
  billingPlanId: string;
  email: string;
  fullName?: string;
}): Promise<void> {
  const plan = getBillingPlan(input.billingPlanId);
  if (!plan) {
    throw new ApiError("validation_failed", "Unknown billing plan.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: input.userId,
      plan_tier: plan.id === "trial" ? plan.planTier : "free",
      stripe_subscription_status: plan.id === "trial" ? "trialing" : "pending_checkout",
      stripe_billing_metadata: {
        email: input.email,
        fullName: input.fullName,
        selectedBillingPlanId: plan.id,
        selectedBillingPlanName: plan.name,
        selectedBillingCadence: plan.cadence,
        trialDays: plan.trialDays
      },
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new ApiError("provider_unavailable", error.message, {
      provider: "supabase",
      operation: "upsertSignupProfile"
    });
  }
}

export function authUserPayload(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}) {
  return {
    id: user.id,
    email: user.email,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {}
  };
}
