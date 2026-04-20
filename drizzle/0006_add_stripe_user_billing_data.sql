ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_status" text;
ALTER TABLE "profiles" ADD COLUMN "stripe_product_id" text;
ALTER TABLE "profiles" ADD COLUMN "stripe_price_id" text;
ALTER TABLE "profiles" ADD COLUMN "stripe_current_period_end" timestamp with time zone;
ALTER TABLE "profiles" ADD COLUMN "stripe_billing_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "stripe_customers" ADD COLUMN "email" text;
ALTER TABLE "stripe_customers" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "stripe_subscriptions" ADD COLUMN "stripe_product_id" text;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "stripe_price_id" text;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "current_period_start" timestamp with time zone;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "cancel_at" timestamp with time zone;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "canceled_at" timestamp with time zone;
ALTER TABLE "stripe_subscriptions" ADD COLUMN "trial_end" timestamp with time zone;

CREATE INDEX "profiles_stripe_subscription_id_idx" ON "profiles" ("stripe_subscription_id");
CREATE INDEX "stripe_subscriptions_customer_id_idx" ON "stripe_subscriptions" ("stripe_customer_id");
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions" ("status");
