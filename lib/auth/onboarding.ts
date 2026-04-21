import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getBillingPlan } from "@/lib/billing/plans";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const onboardingPayloadSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  billingPlanId: z.enum(["trial", "weekly", "monthly", "annually"]).default("trial"),
  rfc: z.string().trim().max(20).optional(),
  requiresCFDI: z.boolean().default(false)
});

export function buildOnboardingAppMetadata(input: {
  userId: string;
  plan: { id: string; name: string; cadence: string; trialDays: number; planTier: "free" | "pro" };
  status: string;
  currentPeriodEnd: Date | null;
  rfc?: string;
  requiresCFDI: boolean;
  capTier: "standard" | "premium";
}): Record<string, unknown> {
  return {
    emailConfirmed: true,
    stripe: {
      supabaseAuthUserId: input.userId,
      selectedBillingPlanId: input.plan.id,
      selectedBillingPlanName: input.plan.name,
      selectedBillingCadence: input.plan.cadence,
      subscriptionStatus: input.status,
      planTier: input.plan.planTier,
      currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
      capTier: input.capTier,
      rfc: input.rfc ?? null,
      requiresCFDI: input.requiresCFDI
    }
  };
}

export async function upsertOnboardingProfile(input: {
  userId: string;
  billingPlanId: string;
  email?: string;
  fullName?: string;
  rfc?: string;
  requiresCFDI: boolean;
  capTier?: "standard" | "premium";
}): Promise<void> {
  const plan = getBillingPlan(input.billingPlanId);
  if (!plan) {
    throw new ApiError("validation_failed", "Unknown billing plan.");
  }

  const isTrial = plan.id === "trial";
  const status = isTrial ? "trialing" : "pending_checkout";
  const now = new Date();
  const currentPeriodEnd = isTrial
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : null;
  const capTier = input.capTier ?? "standard";
  const supabase = getSupabaseAdminClient();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: input.userId,
      plan_tier: isTrial ? plan.planTier : "free",
      stripe_subscription_status: status,
      stripe_current_period_end: currentPeriodEnd?.toISOString() ?? null,
      stripe_billing_metadata: {
        email: input.email ?? null,
        fullName: input.fullName,
        selectedBillingPlanId: plan.id,
        selectedBillingPlanName: plan.name,
        selectedBillingCadence: plan.cadence,
        trialDays: plan.trialDays,
        capTier,
        rfc: input.rfc ?? null,
        requiresCFDI: input.requiresCFDI
      },
      updated_at: now.toISOString()
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    throw new ApiError("provider_unavailable", profileError.message, {
      provider: "supabase",
      operation: "upsertOnboardingProfile"
    });
  }

  const appMetadata = buildOnboardingAppMetadata({
    userId: input.userId,
    plan,
    status,
    currentPeriodEnd,
    rfc: input.rfc,
    requiresCFDI: input.requiresCFDI,
    capTier
  });

  const { error: metadataError } = await supabase.auth.admin.updateUserById(input.userId, {
    app_metadata: appMetadata
  });

  if (metadataError) {
    throw new ApiError("provider_unavailable", metadataError.message, {
      provider: "supabase",
      operation: "updateUserAppMetadata"
    });
  }
}
