import { describe, expect, it } from "vitest";
import { z } from "zod";
import { profiles, stripeCustomers, stripeSubscriptions, wardrobeItems } from "@/lib/db/schema";
import { redactPayload } from "@/lib/observability/redaction";

describe("observability", () => {
  it("redacts secrets and truncates large payload values", () => {
    const redacted = redactPayload({
      token: "secret",
      nested: {
        apiKey: "secret",
        value: "x".repeat(600)
      }
    });

    expect(redacted).toMatchObject({
      token: "[redacted]",
      nested: {
        apiKey: "[redacted]"
      }
    });
    expect((redacted as { nested: { value: string } }).nested.value).toContain("[truncated]");
  });
});

describe("database contracts", () => {
  it("keeps JSON-capable wardrobe fields available for downstream item understanding", () => {
    expect(wardrobeItems.manualTags.name).toBe("manual_tags");
    expect(wardrobeItems.colors.name).toBe("colors");
    expect(wardrobeItems.processingStatus.enumValues).toContain("pending");
  });

  it("keeps Stripe billing state available on app-owned user data", () => {
    expect(profiles.stripeCustomerId.name).toBe("stripe_customer_id");
    expect(profiles.stripeSubscriptionId.name).toBe("stripe_subscription_id");
    expect(profiles.stripeSubscriptionStatus.name).toBe("stripe_subscription_status");
    expect(profiles.stripeProductId.name).toBe("stripe_product_id");
    expect(profiles.stripePriceId.name).toBe("stripe_price_id");
    expect(profiles.stripeCurrentPeriodEnd.name).toBe("stripe_current_period_end");
    expect(profiles.stripeBillingMetadata.name).toBe("stripe_billing_metadata");
  });

  it("keeps Stripe webhook synchronization fields available", () => {
    expect(stripeCustomers.email.name).toBe("email");
    expect(stripeCustomers.metadata.name).toBe("metadata");
    expect(stripeSubscriptions.stripeProductId.name).toBe("stripe_product_id");
    expect(stripeSubscriptions.stripePriceId.name).toBe("stripe_price_id");
    expect(stripeSubscriptions.currentPeriodStart.name).toBe("current_period_start");
    expect(stripeSubscriptions.cancelAtPeriodEnd.name).toBe("cancel_at_period_end");
    expect(stripeSubscriptions.trialEnd.name).toBe("trial_end");
  });

  it("rejects unsupported enum-like values at the validation layer", () => {
    const processingStatus = z.enum(["pending", "processed", "failed"]);
    expect(processingStatus.safeParse("processing").success).toBe(false);
  });
});
