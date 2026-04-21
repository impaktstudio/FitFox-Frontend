import Stripe from "stripe";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";
import { recordProviderRun } from "@/lib/observability/provider-runs";
import { getStripeClient } from "@/lib/stripe/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type StripeEventPayload = Record<string, unknown>;

type StripeCustomerSync = {
  userId: string;
  stripeCustomerId: string;
  email: string | null;
  metadata: Record<string, unknown>;
};

type StripeSubscriptionSync = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
  canceledAt: Date | null;
  trialEnd: Date | null;
  metadata: Record<string, unknown>;
};

type StripeSupabaseBillingSync = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  status?: string | null;
  planTier?: "free" | "pro";
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: Date | null;
  metadata: Record<string, unknown>;
};

export type StripeWebhookStore = {
  markEventReceived(input: {
    stripeEventId: string;
    eventType: string;
    payload: StripeEventPayload;
  }): Promise<"inserted" | "duplicate_processed" | "duplicate_unprocessed">;
  markEventProcessed(stripeEventId: string): Promise<void>;
  getUserIdByCustomerId(stripeCustomerId: string): Promise<string | null>;
  getUserIdByEmail(email: string): Promise<string | null>;
  upsertCustomer(input: StripeCustomerSync): Promise<void>;
  upsertSubscription(input: StripeSubscriptionSync): Promise<void>;
  syncSupabaseUserBilling(input: StripeSupabaseBillingSync): Promise<void>;
};

export type StripeWebhookResult = {
  eventId: string;
  eventType: string;
  processed: boolean;
  duplicate: boolean;
};

const userIdSchema = z.uuid();
const stripeSupabaseBillingTags = ["rfc", "requested_rfc"] as const;

type SupabaseError = {
  code?: string;
  message: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stripePayload(event: Stripe.Event): StripeEventPayload {
  return JSON.parse(JSON.stringify(event)) as StripeEventPayload;
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const userId = metadata?.userId ?? metadata?.fitfoxUserId;
  const parsed = userIdSchema.safeParse(userId);

  return parsed.success ? parsed.data : null;
}

function dateFromUnix(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function customerIdFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  return typeof record.id === "string" ? record.id : null;
}

function customerEmailFromValue(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record.email === "string" ? record.email : null;
}

function priceProductId(price: Stripe.Price | null | undefined): string | null {
  if (!price) {
    return null;
  }

  return typeof price.product === "string" ? price.product : price.product.id;
}

function planTierFromStatus(status: string): "free" | "pro" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

function throwSupabaseError(error: SupabaseError | null, operation: string): void {
  if (!error) {
    return;
  }

  throw new ApiError("provider_unavailable", error.message, {
    provider: "supabase",
    operation
  });
}

function mergeBillingTags(value: unknown): string[] {
  const existingTags = Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : [];

  return [...new Set([...existingTags, ...stripeSupabaseBillingTags])];
}

export function buildStripeSupabaseAppMetadata(
  existingMetadata: Record<string, unknown>,
  input: StripeSupabaseBillingSync
): Record<string, unknown> {
  const existingStripeMetadata = asRecord(existingMetadata.stripe);

  return {
    ...existingMetadata,
    tags: mergeBillingTags(existingMetadata.tags),
    stripe: {
      ...existingStripeMetadata,
      supabaseAuthUserId: input.userId,
      customerId: input.stripeCustomerId,
      subscriptionId: input.stripeSubscriptionId ?? existingStripeMetadata.subscriptionId ?? null,
      subscriptionStatus: input.status ?? existingStripeMetadata.subscriptionStatus ?? null,
      planTier: input.planTier ?? existingStripeMetadata.planTier ?? null,
      productId: input.stripeProductId ?? existingStripeMetadata.productId ?? null,
      priceId: input.stripePriceId ?? existingStripeMetadata.priceId ?? null,
      currentPeriodEnd:
        input.currentPeriodEnd === undefined
          ? existingStripeMetadata.currentPeriodEnd ?? null
          : input.currentPeriodEnd?.toISOString() ?? null,
      billingMetadata: input.metadata
    }
  };
}

async function syncSupabaseUserBilling(input: StripeSupabaseBillingSync): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(input.userId);

  if (error) {
    throw new ApiError("provider_unavailable", error.message, {
      provider: "supabase",
      operation: "getUserById"
    });
  }

  const appMetadata = buildStripeSupabaseAppMetadata(asRecord(data.user?.app_metadata), input);
  const { error: updateError } = await supabase.auth.admin.updateUserById(input.userId, {
    app_metadata: appMetadata
  });

  if (updateError) {
    throw new ApiError("provider_unavailable", updateError.message, {
      provider: "supabase",
      operation: "updateUserById"
    });
  }
}

function getDefaultStripeWebhookStore(): StripeWebhookStore {
  const supabase = getSupabaseAdminClient();

  return {
    async markEventReceived(input) {
      const { error } = await supabase
        .from("stripe_events")
        .insert({
          stripe_event_id: input.stripeEventId,
          event_type: input.eventType,
          payload: input.payload,
          processed: false
        })
        .select("id")
        .single();

      if (!error) {
        return "inserted";
      }

      if (error.code !== "23505") {
        throwSupabaseError(error, "insertStripeEvent");
      }

      const { data: existingEvent, error: selectError } = await supabase
        .from("stripe_events")
        .select("processed")
        .eq("stripe_event_id", input.stripeEventId)
        .maybeSingle();

      throwSupabaseError(selectError, "selectStripeEvent");

      return existingEvent?.processed ? "duplicate_processed" : "duplicate_unprocessed";
    },
    async markEventProcessed(stripeEventId) {
      const { error } = await supabase
        .from("stripe_events")
        .update({
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq("stripe_event_id", stripeEventId);

      throwSupabaseError(error, "markStripeEventProcessed");
    },
    async getUserIdByCustomerId(stripeCustomerId) {
      const { data: customer, error } = await supabase
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

      throwSupabaseError(error, "selectStripeCustomer");

      return typeof customer?.user_id === "string" ? customer.user_id : null;
    },
    async getUserIdByEmail(email) {
      const normalizedEmail = email.toLowerCase();

      const { data: customer, error: customerError } = await supabase
        .from("stripe_customers")
        .select("user_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (customerError) {
        throwSupabaseError(customerError, "selectStripeCustomerByEmail");
      }

      if (typeof customer?.user_id === "string") {
        return customer.user_id;
      }

      for (let page = 1; page <= 3; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000
        });

        if (error) {
          throw new ApiError("provider_unavailable", error.message, {
            provider: "supabase",
            operation: "listUsers"
          });
        }

        const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
        if (user) {
          return user.id;
        }

        if (!data.nextPage) {
          return null;
        }
      }

      return null;
    },
    async upsertCustomer(input) {
      const updatedAt = new Date().toISOString();
      const { error: customerError } = await supabase
        .from("stripe_customers")
        .upsert(
          {
            user_id: input.userId,
            stripe_customer_id: input.stripeCustomerId,
            email: input.email,
            metadata: input.metadata,
            updated_at: updatedAt
          },
          { onConflict: "stripe_customer_id" }
        );

      throwSupabaseError(customerError, "upsertStripeCustomer");

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: input.userId,
            stripe_customer_id: input.stripeCustomerId,
            stripe_billing_metadata: input.metadata,
            updated_at: updatedAt
          },
          { onConflict: "user_id" }
        );

      throwSupabaseError(profileError, "upsertProfileStripeCustomer");
    },
    async upsertSubscription(input) {
      const planTier = planTierFromStatus(input.status);
      const updatedAt = new Date().toISOString();

      const { error: subscriptionError } = await supabase
        .from("stripe_subscriptions")
        .upsert(
          {
            user_id: input.userId,
            stripe_customer_id: input.stripeCustomerId,
            stripe_subscription_id: input.stripeSubscriptionId,
            status: input.status,
            stripe_product_id: input.stripeProductId,
            stripe_price_id: input.stripePriceId,
            current_period_start: input.currentPeriodStart?.toISOString() ?? null,
            current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
            cancel_at_period_end: input.cancelAtPeriodEnd,
            cancel_at: input.cancelAt?.toISOString() ?? null,
            canceled_at: input.canceledAt?.toISOString() ?? null,
            trial_end: input.trialEnd?.toISOString() ?? null,
            metadata: input.metadata,
            updated_at: updatedAt
          },
          { onConflict: "stripe_subscription_id" }
        );

      throwSupabaseError(subscriptionError, "upsertStripeSubscription");

      const { data: existingProfile, error: selectProfileError } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("user_id", input.userId)
        .maybeSingle();

      throwSupabaseError(selectProfileError, "selectProfilePlanTier");

      const nextPlanTier = existingProfile?.plan_tier === "founder" ? "founder" : planTier;
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: input.userId,
            plan_tier: nextPlanTier,
            stripe_customer_id: input.stripeCustomerId,
            stripe_subscription_id: input.stripeSubscriptionId,
            stripe_subscription_status: input.status,
            stripe_product_id: input.stripeProductId,
            stripe_price_id: input.stripePriceId,
            stripe_current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
            stripe_billing_metadata: input.metadata,
            updated_at: updatedAt
          },
          { onConflict: "user_id" }
        );

      throwSupabaseError(profileError, "upsertProfileStripeSubscription");
    },
    syncSupabaseUserBilling
  };
}

async function syncCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer, store: StripeWebhookStore): Promise<boolean> {
  if ("deleted" in customer && customer.deleted) {
    return true;
  }

  const userId = metadataUserId(customer.metadata) ?? (customer.email ? await store.getUserIdByEmail(customer.email) : null);
  if (!userId) {
    return false;
  }

  await store.upsertCustomer({
    userId,
    stripeCustomerId: customer.id,
    email: customer.email,
    metadata: customer.metadata
  });
  await store.syncSupabaseUserBilling({
    userId,
    stripeCustomerId: customer.id,
    metadata: customer.metadata
  });

  return true;
}

async function syncCheckoutSession(session: Stripe.Checkout.Session, store: StripeWebhookStore): Promise<boolean> {
  const stripeCustomerId = customerIdFromValue(session.customer);
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const userId =
    metadataUserId(session.metadata) ??
    userIdSchema.safeParse(session.client_reference_id).data ??
    (email ? await store.getUserIdByEmail(email) : null);

  if (!stripeCustomerId || !userId) {
    return false;
  }

  await store.upsertCustomer({
    userId,
    stripeCustomerId,
    email,
    metadata: session.metadata ?? {}
  });
  await store.syncSupabaseUserBilling({
    userId,
    stripeCustomerId,
    metadata: session.metadata ?? {}
  });

  return true;
}

async function syncSubscription(subscription: Stripe.Subscription, store: StripeWebhookStore): Promise<boolean> {
  const stripeCustomerId = customerIdFromValue(subscription.customer);
  if (!stripeCustomerId) {
    return false;
  }

  const customerEmail = customerEmailFromValue(subscription.customer);
  const userId =
    metadataUserId(subscription.metadata) ??
    (await store.getUserIdByCustomerId(stripeCustomerId)) ??
    (customerEmail ? await store.getUserIdByEmail(customerEmail) : null);
  if (!userId) {
    return false;
  }

  const [firstItem] = subscription.items.data;
  const subscriptionRecord = subscription as unknown as Record<string, unknown>;

  const syncInput = {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    stripeProductId: priceProductId(firstItem?.price),
    stripePriceId: firstItem?.price.id ?? null,
    currentPeriodStart: dateFromUnix(subscriptionRecord.current_period_start),
    currentPeriodEnd: dateFromUnix(subscriptionRecord.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: dateFromUnix(subscription.cancel_at),
    canceledAt: dateFromUnix(subscription.canceled_at),
    trialEnd: dateFromUnix(subscription.trial_end),
    metadata: subscription.metadata
  };

  await store.upsertSubscription(syncInput);
  await store.syncSupabaseUserBilling({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    planTier: planTierFromStatus(subscription.status),
    stripeProductId: syncInput.stripeProductId,
    stripePriceId: syncInput.stripePriceId,
    currentPeriodEnd: syncInput.currentPeriodEnd,
    metadata: subscription.metadata
  });

  return true;
}

async function syncStripeEvent(event: Stripe.Event, store: StripeWebhookStore): Promise<boolean> {
  switch (event.type) {
    case "customer.created":
    case "customer.updated":
    case "customer.deleted":
      return syncCustomer(event.data.object, store);
    case "checkout.session.completed":
      return syncCheckoutSession(event.data.object, store);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(event.data.object, store);
    default:
      return true;
  }
}

export function constructStripeWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  const env = getEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new ApiError("provider_unavailable", "Stripe webhook secret is not configured.", { provider: "stripe" });
  }

  if (!signature) {
    throw new ApiError("bad_request", "Missing Stripe-Signature header.");
  }

  try {
    return getStripeClient(env).webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
    throw new ApiError("bad_request", `Stripe webhook verification failed: ${message}`);
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  store: StripeWebhookStore = getDefaultStripeWebhookStore()
): Promise<StripeWebhookResult> {
  const startedAt = performance.now();
  const routeName = "stripe_webhook";

  try {
    const received = await store.markEventReceived({
      stripeEventId: event.id,
      eventType: event.type,
      payload: stripePayload(event)
    });

    if (received === "duplicate_processed") {
      await recordProviderRun({
        routeName,
        providerName: "stripe",
        executionMode: "remote",
        latencyMs: Math.round(performance.now() - startedAt),
        status: "skipped",
        responsePayload: { eventId: event.id, eventType: event.type, duplicate: true, reason: "already_processed" }
      });
      return {
        eventId: event.id,
        eventType: event.type,
        processed: true,
        duplicate: true
      };
    }

    const processed = await syncStripeEvent(event, store);

    if (processed) {
      await store.markEventProcessed(event.id);
    }

    await recordProviderRun({
      routeName,
      providerName: "stripe",
      executionMode: "remote",
      latencyMs: Math.round(performance.now() - startedAt),
      status: "success",
      responsePayload: { eventId: event.id, eventType: event.type, processed, duplicate: received === "duplicate_unprocessed" }
    });

    return {
      eventId: event.id,
      eventType: event.type,
      processed,
      duplicate: received === "duplicate_unprocessed"
    };
  } catch (error) {
    await recordProviderRun({
      routeName,
      providerName: "stripe",
      executionMode: "remote",
      latencyMs: Math.round(performance.now() - startedAt),
      status: "failed",
      errorDetails: {
        message: error instanceof Error ? error.message : "Unknown Stripe webhook error",
        eventId: event.id,
        eventType: event.type
      }
    });
    throw error;
  }
}
