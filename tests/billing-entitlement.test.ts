import { describe, expect, it } from "vitest";
import {
  assertAccountEntitled,
  isAccountExpired,
  isTrialOrExpiredRequiringConfirmation,
  parseAccountEntitlementFromAppMetadata,
  parseAccountEntitlementFromProfile
} from "@/lib/billing/entitlement";
import { ApiError } from "@/lib/api/errors";

const userId = "00000000-0000-4000-8000-000000000001";

describe("billing entitlement", () => {
  it("parses profile row with full metadata", () => {
    const entitlement = parseAccountEntitlementFromProfile({
      user_id: userId,
      plan_tier: "pro",
      stripe_subscription_status: "trialing",
      stripe_current_period_end: "2026-05-01T00:00:00.000Z",
      stripe_billing_metadata: {
        selectedBillingPlanId: "trial",
        selectedBillingPlanName: "Free trial",
        selectedBillingCadence: "7 days",
        capTier: "premium",
        rfc: "ABCD010101A12",
        requiresCFDI: true
      }
    });

    expect(entitlement).toEqual({
      userId,
      planTier: "pro",
      selectedBillingPlanId: "trial",
      selectedBillingPlanName: "Free trial",
      billingCadence: "7 days",
      status: "trialing",
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      capTier: "premium",
      rfc: "ABCD010101A12",
      requiresCFDI: true,
      emailConfirmed: false
    });
  });

  it("parses profile with email_confirmed_at as confirmed", () => {
    const entitlement = parseAccountEntitlementFromProfile({
      user_id: userId,
      plan_tier: "free",
      stripe_subscription_status: "pending_checkout",
      stripe_billing_metadata: {},
      email_confirmed_at: "2026-04-20T12:00:00.000Z"
    });

    expect(entitlement.emailConfirmed).toBe(true);
  });

  it("parses app metadata into entitlement", () => {
    const entitlement = parseAccountEntitlementFromAppMetadata({
      emailConfirmed: true,
      stripe: {
        supabaseAuthUserId: userId,
        selectedBillingPlanId: "monthly",
        selectedBillingPlanName: "Monthly",
        selectedBillingCadence: "per month",
        subscriptionStatus: "active",
        planTier: "pro",
        currentPeriodEnd: "2026-12-01T00:00:00.000Z",
        capTier: "standard",
        rfc: "XYZ990101A12",
        requiresCFDI: false
      }
    });

    expect(entitlement).toEqual({
      userId,
      planTier: "pro",
      selectedBillingPlanId: "monthly",
      selectedBillingPlanName: "Monthly",
      billingCadence: "per month",
      status: "active",
      currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      capTier: "standard",
      rfc: "XYZ990101A12",
      requiresCFDI: false,
      emailConfirmed: true
    });
  });

  it("returns null for app metadata without userId", () => {
    expect(parseAccountEntitlementFromAppMetadata({})).toBeNull();
  });

  it("asserts entitlement for active subscription inside period", () => {
    expect(() =>
      assertAccountEntitled(
        {
          userId,
          planTier: "pro",
          selectedBillingPlanId: "monthly",
          selectedBillingPlanName: "Monthly",
          billingCadence: "per month",
          status: "active",
          currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
          capTier: "standard",
          rfc: null,
          requiresCFDI: false,
          emailConfirmed: true
        },
        new Date("2026-04-20T12:00:00.000Z")
      )
    ).not.toThrow();
  });

  it("throws for expired subscription", () => {
    expect(() =>
      assertAccountEntitled(
        {
          userId,
          planTier: "pro",
          selectedBillingPlanId: "monthly",
          selectedBillingPlanName: "Monthly",
          billingCadence: "per month",
          status: "active",
          currentPeriodEnd: new Date("2026-04-19T00:00:00.000Z"),
          capTier: "standard",
          rfc: null,
          requiresCFDI: false,
          emailConfirmed: true
        },
        new Date("2026-04-20T12:00:00.000Z")
      )
    ).toThrow(ApiError);
  });

  it("detects trial requiring confirmation when email unconfirmed", () => {
    const entitlement = {
      userId,
      planTier: "pro" as const,
      selectedBillingPlanId: "trial",
      selectedBillingPlanName: "Free trial",
      billingCadence: "7 days",
      status: "trialing" as const,
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      capTier: "standard" as const,
      rfc: null,
      requiresCFDI: false,
      emailConfirmed: false
    };

    expect(isTrialOrExpiredRequiringConfirmation(entitlement, new Date("2026-04-20T12:00:00.000Z"))).toBe(true);
  });

  it("does not require confirmation when email is confirmed", () => {
    const entitlement = {
      userId,
      planTier: "pro" as const,
      selectedBillingPlanId: "trial",
      selectedBillingPlanName: "Free trial",
      billingCadence: "7 days",
      status: "trialing" as const,
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      capTier: "standard" as const,
      rfc: null,
      requiresCFDI: false,
      emailConfirmed: true
    };

    expect(isTrialOrExpiredRequiringConfirmation(entitlement, new Date("2026-04-20T12:00:00.000Z"))).toBe(false);
  });

  it("requires confirmation for expired account with unconfirmed email", () => {
    const entitlement = {
      userId,
      planTier: "free" as const,
      selectedBillingPlanId: "monthly",
      selectedBillingPlanName: "Monthly",
      billingCadence: "per month",
      status: "active" as const,
      currentPeriodEnd: new Date("2026-04-19T00:00:00.000Z"),
      capTier: "standard" as const,
      rfc: null,
      requiresCFDI: false,
      emailConfirmed: false
    };

    expect(isTrialOrExpiredRequiringConfirmation(entitlement, new Date("2026-04-20T12:00:00.000Z"))).toBe(true);
  });

  it("detects account as expired when past currentPeriodEnd", () => {
    const entitlement = {
      userId,
      planTier: "pro" as const,
      selectedBillingPlanId: "monthly",
      selectedBillingPlanName: "Monthly",
      billingCadence: "per month",
      status: "active" as const,
      currentPeriodEnd: new Date("2026-04-19T00:00:00.000Z"),
      capTier: "standard" as const,
      rfc: null,
      requiresCFDI: false,
      emailConfirmed: true
    };

    expect(isAccountExpired(entitlement, new Date("2026-04-20T12:00:00.000Z"))).toBe(true);
  });

  it("does not detect active account as expired", () => {
    const entitlement = {
      userId,
      planTier: "pro" as const,
      selectedBillingPlanId: "monthly",
      selectedBillingPlanName: "Monthly",
      billingCadence: "per month",
      status: "active" as const,
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      capTier: "standard" as const,
      rfc: null,
      requiresCFDI: false,
      emailConfirmed: true
    };

    expect(isAccountExpired(entitlement, new Date("2026-04-20T12:00:00.000Z"))).toBe(false);
  });
});
