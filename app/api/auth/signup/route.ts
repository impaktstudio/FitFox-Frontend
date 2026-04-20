import { ApiError } from "@/lib/api/errors";
import { authFailure, authResponse, authUserPayload, parseAuthPayload, upsertSignupProfile } from "@/lib/auth/api";
import { getBillingPlan } from "@/lib/billing/plans";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await parseAuthPayload(request);
    const plan = getBillingPlan(payload.billingPlanId);

    if (!plan) {
      throw new ApiError("validation_failed", "Unknown billing plan.");
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          fullName: payload.fullName,
          billingPlanId: plan.id,
          billingPlanName: plan.name,
          billingCadence: plan.cadence,
          trialDays: plan.trialDays
        }
      }
    });

    if (error) {
      throw new ApiError("provider_unavailable", error.message, {
        provider: "supabase",
        operation: "signUp"
      });
    }

    if (!data.user) {
      throw new ApiError("provider_unavailable", "Supabase did not return a user.", {
        provider: "supabase"
      });
    }

    await upsertSignupProfile({
      userId: data.user.id,
      billingPlanId: plan.id,
      email: payload.email,
      fullName: payload.fullName
    });

    return authResponse(
      request,
      {
        user: authUserPayload(data.user),
        plan,
        emailConfirmationRequired: !data.session
      },
      data.session ?? undefined
    );
  } catch (error) {
    return authFailure(request, error);
  }
}
