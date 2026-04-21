import { ApiError } from "@/lib/api/errors";

type BillingEntitlementStatus =
  | "active"
  | "trialing"
  | "pending_checkout"
  | "canceled"
  | "past_due"
  | "unpaid"
  | null;

export type AccountEntitlement = {
  userId: string;
  planTier: "free" | "pro" | "founder";
  selectedBillingPlanId: string | null;
  selectedBillingPlanName: string | null;
  billingCadence: string | null;
  status: BillingEntitlementStatus;
  currentPeriodEnd: Date | null;
  capTier: "standard" | "premium";
  rfc: string | null;
  requiresCFDI: boolean;
  emailConfirmed: boolean;
};

export function parseAccountEntitlementFromProfile(row: Record<string, unknown>): AccountEntitlement {
  const metadata = asRecord(row.stripe_billing_metadata);
  const periodEndValue = row.stripe_current_period_end;
  const currentPeriodEnd =
    typeof periodEndValue === "string" || typeof periodEndValue === "number"
      ? new Date(periodEndValue)
      : null;

  return {
    userId: typeof row.user_id === "string" ? row.user_id : "",
    planTier: row.plan_tier === "pro" || row.plan_tier === "founder" ? row.plan_tier : "free",
    selectedBillingPlanId: typeof metadata.selectedBillingPlanId === "string" ? metadata.selectedBillingPlanId : null,
    selectedBillingPlanName: typeof metadata.selectedBillingPlanName === "string" ? metadata.selectedBillingPlanName : null,
    billingCadence: typeof metadata.selectedBillingCadence === "string" ? metadata.selectedBillingCadence : null,
    status: typeof row.stripe_subscription_status === "string" ? (row.stripe_subscription_status as BillingEntitlementStatus) : null,
    currentPeriodEnd: currentPeriodEnd && Number.isFinite(currentPeriodEnd.getTime()) ? currentPeriodEnd : null,
    capTier: metadata.capTier === "premium" ? "premium" : "standard",
    rfc: typeof metadata.rfc === "string" ? metadata.rfc : null,
    requiresCFDI: metadata.requiresCFDI === true,
    emailConfirmed: row.email_confirmed === true || typeof row.email_confirmed_at === "string"
  };
}

export function parseAccountEntitlementFromAppMetadata(metadata: Record<string, unknown>): AccountEntitlement | null {
  const stripe = asRecord(metadata.stripe);
  const periodEndValue = stripe.currentPeriodEnd;
  const currentPeriodEnd =
    typeof periodEndValue === "string" || typeof periodEndValue === "number"
      ? new Date(periodEndValue)
      : null;

  const userId = typeof stripe.supabaseAuthUserId === "string" ? stripe.supabaseAuthUserId : null;
  if (!userId) {
    return null;
  }

  return {
    userId,
    planTier: stripe.planTier === "pro" || stripe.planTier === "founder" ? (stripe.planTier as AccountEntitlement["planTier"]) : "free",
    selectedBillingPlanId: typeof stripe.selectedBillingPlanId === "string" ? stripe.selectedBillingPlanId : null,
    selectedBillingPlanName: typeof stripe.selectedBillingPlanName === "string" ? stripe.selectedBillingPlanName : null,
    billingCadence: typeof stripe.selectedBillingCadence === "string" ? stripe.selectedBillingCadence : null,
    status: typeof stripe.subscriptionStatus === "string" ? (stripe.subscriptionStatus as BillingEntitlementStatus) : null,
    currentPeriodEnd: currentPeriodEnd && Number.isFinite(currentPeriodEnd.getTime()) ? currentPeriodEnd : null,
    capTier: stripe.capTier === "premium" ? "premium" : "standard",
    rfc: typeof stripe.rfc === "string" ? stripe.rfc : null,
    requiresCFDI: stripe.requiresCFDI === true,
    emailConfirmed: metadata.emailConfirmed === true
  };
}

export function isSubscriptionActive(status: BillingEntitlementStatus): boolean {
  return status === "active" || status === "trialing";
}

export function assertAccountEntitled(entitlement: AccountEntitlement, now = new Date()): void {
  if (!isSubscriptionActive(entitlement.status)) {
    throw new ApiError("auth_required", "An active subscription is required.");
  }

  if (!entitlement.currentPeriodEnd || entitlement.currentPeriodEnd.getTime() <= now.getTime()) {
    throw new ApiError("auth_required", "The current subscription period has ended.");
  }
}

export function isTrialOrExpiredRequiringConfirmation(entitlement: AccountEntitlement, now = new Date()): boolean {
  // If email is already confirmed, never require confirmation via middleware
  if (entitlement.emailConfirmed) {
    return false;
  }

  // Trial accounts without confirmed email require confirmation
  if (entitlement.status === "trialing") {
    return true;
  }

  // Expired accounts (past currentPeriodEnd) without confirmed email require confirmation
  if (!entitlement.currentPeriodEnd || entitlement.currentPeriodEnd.getTime() <= now.getTime()) {
    return true;
  }

  return false;
}

export function isAccountExpired(entitlement: AccountEntitlement, now = new Date()): boolean {
  if (!isSubscriptionActive(entitlement.status)) {
    return true;
  }

  if (!entitlement.currentPeriodEnd || entitlement.currentPeriodEnd.getTime() <= now.getTime()) {
    return true;
  }

  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
