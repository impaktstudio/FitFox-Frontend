import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  buildStripeSupabaseAppMetadata,
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  type StripeWebhookStore
} from "@/lib/stripe/webhook";

const userId = "00000000-0000-4000-8000-000000000001";

class FakeStripeWebhookStore implements StripeWebhookStore {
  readonly received = new Set<string>();
  readonly customers = new Map<string, Parameters<StripeWebhookStore["upsertCustomer"]>[0]>();
  readonly subscriptions = new Map<string, Parameters<StripeWebhookStore["upsertSubscription"]>[0]>();
  readonly supabaseUsers = new Map<string, Parameters<StripeWebhookStore["syncSupabaseUserBilling"]>[0]>();
  readonly authUsersByEmail = new Map<string, string>();
  readonly processed = new Set<string>();

  constructor(private readonly duplicateEventIds = new Set<string>()) {}

  async markEventReceived(input: Parameters<StripeWebhookStore["markEventReceived"]>[0]) {
    if (this.duplicateEventIds.has(input.stripeEventId)) {
      return this.processed.has(input.stripeEventId) ? "duplicate_processed" as const : "duplicate_unprocessed" as const;
    }

    this.received.add(input.stripeEventId);
    return "inserted" as const;
  }

  async markEventProcessed(stripeEventId: string) {
    this.processed.add(stripeEventId);
  }

  async getUserIdByCustomerId(stripeCustomerId: string) {
    return this.customers.get(stripeCustomerId)?.userId ?? null;
  }

  async getUserIdByEmail(email: string) {
    return this.authUsersByEmail.get(email.toLowerCase()) ?? null;
  }

  async upsertCustomer(input: Parameters<StripeWebhookStore["upsertCustomer"]>[0]) {
    this.customers.set(input.stripeCustomerId, input);
  }

  async upsertSubscription(input: Parameters<StripeWebhookStore["upsertSubscription"]>[0]) {
    this.subscriptions.set(input.stripeSubscriptionId, input);
  }

  async syncSupabaseUserBilling(input: Parameters<StripeWebhookStore["syncSupabaseUserBilling"]>[0]) {
    this.supabaseUsers.set(input.userId, input);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe webhooks", () => {
  it("constructs signed events from the raw request body", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");

    const stripe = new Stripe("sk_test_123");
    const payload = JSON.stringify({
      id: "evt_signed",
      object: "event",
      type: "customer.updated",
      data: {
        object: {
          id: "cus_123",
          object: "customer",
          metadata: { userId }
        }
      }
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_test_secret"
    });

    expect(constructStripeWebhookEvent(payload, signature)).toMatchObject({
      id: "evt_signed",
      type: "customer.updated"
    });
  });

  it("rejects requests without a Stripe signature", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");

    expect(() => constructStripeWebhookEvent("{}", null)).toThrow(ApiError);
  });

  it("returns success for duplicate events without processing again", async () => {
    const store = new FakeStripeWebhookStore(new Set(["evt_duplicate"]));
    store.processed.add("evt_duplicate");
    const event = {
      id: "evt_duplicate",
      type: "customer.updated",
      data: {
        object: {
          id: "cus_duplicate",
          object: "customer",
          metadata: { userId }
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toEqual({
      eventId: "evt_duplicate",
      eventType: "customer.updated",
      processed: true,
      duplicate: true
    });
    expect(store.customers.size).toBe(0);
    expect(store.processed.size).toBe(1);
  });

  it("retries duplicate events that were recorded but not processed", async () => {
    const store = new FakeStripeWebhookStore(new Set(["evt_retry"]));
    const event = {
      id: "evt_retry",
      type: "customer.updated",
      data: {
        object: {
          id: "cus_retry",
          object: "customer",
          email: "maya@example.com",
          metadata: { userId }
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toEqual({
      eventId: "evt_retry",
      eventType: "customer.updated",
      processed: true,
      duplicate: true
    });
    expect(store.customers.get("cus_retry")).toMatchObject({
      userId,
      email: "maya@example.com"
    });
    expect(store.processed.has("evt_retry")).toBe(true);
  });

  it("syncs checkout session customer mappings", async () => {
    const store = new FakeStripeWebhookStore();
    const event = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          customer: "cus_checkout",
          customer_details: { email: "maya@example.com" },
          client_reference_id: userId,
          metadata: {}
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toMatchObject({
      processed: true,
      duplicate: false
    });
    expect(store.customers.get("cus_checkout")).toMatchObject({
      userId,
      email: "maya@example.com"
    });
    expect(store.supabaseUsers.get(userId)).toMatchObject({
      stripeCustomerId: "cus_checkout"
    });
    expect(store.processed.has("evt_checkout")).toBe(true);
  });

  it("resolves checkout sessions through Supabase Auth email", async () => {
    const store = new FakeStripeWebhookStore();
    store.authUsersByEmail.set("maya@example.com", userId);
    const event = {
      id: "evt_checkout_auth",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_auth",
          object: "checkout.session",
          customer: "cus_auth",
          customer_details: { email: "Maya@example.com" },
          client_reference_id: null,
          metadata: {}
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toMatchObject({
      processed: true,
      duplicate: false
    });
    expect(store.customers.get("cus_auth")).toMatchObject({
      userId,
      email: "Maya@example.com"
    });
    expect(store.supabaseUsers.get(userId)).toMatchObject({
      stripeCustomerId: "cus_auth"
    });
  });

  it("syncs subscriptions using an existing customer mapping", async () => {
    const store = new FakeStripeWebhookStore();
    await store.upsertCustomer({
      userId,
      stripeCustomerId: "cus_subscription",
      email: "maya@example.com",
      metadata: {}
    });

    const event = {
      id: "evt_subscription",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          object: "subscription",
          customer: "cus_subscription",
          status: "active",
          current_period_start: 1767225600,
          current_period_end: 1769904000,
          cancel_at_period_end: false,
          cancel_at: null,
          canceled_at: null,
          trial_end: null,
          metadata: {},
          items: {
            data: [
              {
                price: {
                  id: "price_123",
                  product: "prod_123"
                }
              }
            ]
          }
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toMatchObject({
      processed: true,
      duplicate: false
    });
    expect(store.subscriptions.get("sub_123")).toMatchObject({
      userId,
      stripeCustomerId: "cus_subscription",
      status: "active",
      stripeProductId: "prod_123",
      stripePriceId: "price_123",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z")
    });
    expect(store.supabaseUsers.get(userId)).toMatchObject({
      stripeCustomerId: "cus_subscription",
      stripeSubscriptionId: "sub_123",
      planTier: "pro"
    });
    expect(store.processed.has("evt_subscription")).toBe(true);
  });

  it("resolves subscriptions through expanded Stripe customer email and Supabase Auth", async () => {
    const store = new FakeStripeWebhookStore();
    store.authUsersByEmail.set("maya@example.com", userId);
    const event = {
      id: "evt_subscription_auth",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_auth",
          object: "subscription",
          customer: {
            id: "cus_subscription_auth",
            object: "customer",
            email: "maya@example.com"
          },
          status: "trialing",
          current_period_start: 1767225600,
          current_period_end: 1769904000,
          cancel_at_period_end: false,
          cancel_at: null,
          canceled_at: null,
          trial_end: null,
          metadata: {},
          items: {
            data: [
              {
                price: {
                  id: "price_auth",
                  product: "prod_auth"
                }
              }
            ]
          }
        }
      }
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event, store)).resolves.toMatchObject({
      processed: true,
      duplicate: false
    });
    expect(store.subscriptions.get("sub_auth")).toMatchObject({
      userId,
      stripeCustomerId: "cus_subscription_auth",
      status: "trialing",
      stripeProductId: "prod_auth",
      stripePriceId: "price_auth"
    });
    expect(store.supabaseUsers.get(userId)).toMatchObject({
      stripeCustomerId: "cus_subscription_auth",
      stripeSubscriptionId: "sub_auth",
      planTier: "pro"
    });
  });

  it("builds Supabase app metadata with rfc and requested_rfc tags", () => {
    expect(
      buildStripeSupabaseAppMetadata(
        {
          tags: ["existing"],
          stripe: {
            preserved: true
          }
        },
        {
          userId,
          stripeCustomerId: "cus_tagged",
          stripeSubscriptionId: "sub_tagged",
          status: "active",
          planTier: "pro",
          stripeProductId: "prod_tagged",
          stripePriceId: "price_tagged",
          currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
          metadata: {
            source: "stripe"
          }
        }
      )
    ).toEqual({
      tags: ["existing", "rfc", "requested_rfc"],
      stripe: {
        preserved: true,
        supabaseAuthUserId: userId,
        customerId: "cus_tagged",
        subscriptionId: "sub_tagged",
        subscriptionStatus: "active",
        planTier: "pro",
        productId: "prod_tagged",
        priceId: "price_tagged",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
        billingMetadata: {
          source: "stripe"
        }
      }
    });
  });

  it("preserves existing Supabase subscription metadata for customer-only events", () => {
    expect(
      buildStripeSupabaseAppMetadata(
        {
          tags: ["rfc"],
          stripe: {
            subscriptionId: "sub_existing",
            subscriptionStatus: "active",
            planTier: "pro",
            productId: "prod_existing",
            priceId: "price_existing",
            currentPeriodEnd: "2026-02-01T00:00:00.000Z"
          }
        },
        {
          userId,
          stripeCustomerId: "cus_updated",
          metadata: {
            source: "customer.updated"
          }
        }
      )
    ).toMatchObject({
      tags: ["rfc", "requested_rfc"],
      stripe: {
        supabaseAuthUserId: userId,
        customerId: "cus_updated",
        subscriptionId: "sub_existing",
        subscriptionStatus: "active",
        planTier: "pro",
        productId: "prod_existing",
        priceId: "price_existing",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z"
      }
    });
  });
});
