CREATE TYPE "public"."gpu_task_status" AS ENUM('reserved', 'queued', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."profile_plan_tier" AS ENUM('free', 'pro', 'founder');--> statement-breakpoint
CREATE TYPE "public"."provider_name" AS ENUM('postgres', 'supabase', 'railway', 'gcs', 'qdrant', 'openrouter', 'vertex', 'posthog', 'sentry', 'stripe', 'inngest', 'gpu_backend', 'mastra');--> statement-breakpoint
CREATE TYPE "public"."provider_run_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."usage_bucket" AS ENUM('embeddings', 'llm', 'gpu_worker_time');--> statement-breakpoint
CREATE TYPE "public"."usage_reservation_status" AS ENUM('reserved', 'consumed', 'released');--> statement-breakpoint
CREATE TABLE "feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"look_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommendation_run_id" uuid NOT NULL,
	"occasion_session_id" uuid,
	"title" text NOT NULL,
	"item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"missing_item_suggestion" text,
	"refinement_suggestion" text,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_score" numeric(5, 2),
	"rank" integer,
	"generation_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpu_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"idempotency_key" text,
	"status" "gpu_task_status" DEFAULT 'reserved' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"worker_result_id" text,
	"failure_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occasion_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_input" text,
	"occasion_mode" text,
	"desired_impression" text,
	"climate_state" text,
	"city" text,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"city" text,
	"segment" text,
	"signup_source" text,
	"plan_tier" "profile_plan_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"stripe_current_period_end" timestamp with time zone,
	"stripe_billing_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"route_name" text NOT NULL,
	"provider_name" "provider_name" NOT NULL,
	"execution_mode" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"status" "provider_run_status" NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qdrant_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wardrobe_item_id" uuid,
	"match_candidate_id" uuid,
	"collection_name" text NOT NULL,
	"point_id" text NOT NULL,
	"vector_name" text DEFAULT 'splade_text' NOT NULL,
	"payload_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occasion_session_id" uuid,
	"mastra_workflow_run_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"execution_mode" text DEFAULT 'local' NOT NULL,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"look_id" uuid NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"look_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bucket" "usage_bucket" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"cap_usd" numeric(12, 6) NOT NULL,
	"reserved_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"consumed_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"bucket" "usage_bucket" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"cost_usd" numeric(12, 6) NOT NULL,
	"status" "usage_reservation_status" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_style_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"primary_archetype" text DEFAULT 'classic' NOT NULL,
	"secondary_archetype" text,
	"sub_archetypes" jsonb,
	"trend_signals" jsonb,
	"values_overlay" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preference_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wardrobe_item_match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wardrobe_item_id" uuid NOT NULL,
	"candidate_text" text NOT NULL,
	"payload_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wardrobe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gcs_object_path" text,
	"description_text" text,
	"manual_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"subcategory" text,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"silhouette_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formality_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archetype_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occasion_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"climate_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_events_user_id_idx" ON "feedback_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_events_look_id_idx" ON "feedback_events" USING btree ("look_id");--> statement-breakpoint
CREATE INDEX "generated_looks_user_id_idx" ON "generated_looks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_looks_recommendation_run_id_idx" ON "generated_looks" USING btree ("recommendation_run_id");--> statement-breakpoint
CREATE INDEX "generated_looks_session_id_idx" ON "generated_looks" USING btree ("occasion_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_tasks_task_id_unique" ON "gpu_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_tasks_user_id_idempotency_key_unique" ON "gpu_tasks" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "gpu_tasks_user_id_idx" ON "gpu_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gpu_tasks_status_idx" ON "gpu_tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_tasks_worker_result_id_unique" ON "gpu_tasks" USING btree ("worker_result_id");--> statement-breakpoint
CREATE INDEX "occasion_sessions_user_id_idx" ON "occasion_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_stripe_customer_id_idx" ON "profiles" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "profiles_stripe_subscription_id_idx" ON "profiles" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "provider_runs_user_id_idx" ON "provider_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_runs_provider_name_idx" ON "provider_runs" USING btree ("provider_name");--> statement-breakpoint
CREATE INDEX "provider_runs_status_idx" ON "provider_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qdrant_points_user_id_idx" ON "qdrant_points" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "qdrant_points_wardrobe_item_id_idx" ON "qdrant_points" USING btree ("wardrobe_item_id");--> statement-breakpoint
CREATE INDEX "qdrant_points_match_candidate_id_idx" ON "qdrant_points" USING btree ("match_candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qdrant_points_collection_point_unique" ON "qdrant_points" USING btree ("collection_name","point_id");--> statement-breakpoint
CREATE INDEX "recommendation_runs_user_id_idx" ON "recommendation_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendation_runs_session_id_idx" ON "recommendation_runs" USING btree ("occasion_session_id");--> statement-breakpoint
CREATE INDEX "saved_looks_user_id_idx" ON "saved_looks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_looks_look_id_idx" ON "saved_looks" USING btree ("look_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_looks_user_look_unique" ON "saved_looks" USING btree ("user_id","look_id");--> statement-breakpoint
CREATE INDEX "share_links_user_id_idx" ON "share_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_links_look_id_idx" ON "share_links" USING btree ("look_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_unique" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "stripe_customers_user_id_idx" ON "stripe_customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_user_id_unique" ON "stripe_customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_unique" ON "stripe_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_events_stripe_event_id_unique" ON "stripe_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_user_id_idx" ON "stripe_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_customer_id_idx" ON "stripe_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_subscriptions_subscription_id_unique" ON "stripe_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "usage_periods_user_id_idx" ON "usage_periods" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_periods_user_bucket_period_unique" ON "usage_periods" USING btree ("user_id","bucket","period_start");--> statement-breakpoint
CREATE INDEX "usage_reservations_task_id_idx" ON "usage_reservations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "usage_reservations_user_id_idx" ON "usage_reservations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_reservations_task_bucket_unique" ON "usage_reservations" USING btree ("task_id","bucket");--> statement-breakpoint
CREATE INDEX "user_style_profiles_user_id_idx" ON "user_style_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_style_profiles_user_id_unique" ON "user_style_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wardrobe_item_match_candidates_user_id_idx" ON "wardrobe_item_match_candidates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wardrobe_item_match_candidates_item_id_idx" ON "wardrobe_item_match_candidates" USING btree ("wardrobe_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wardrobe_item_match_candidates_payload_hash_unique" ON "wardrobe_item_match_candidates" USING btree ("user_id","wardrobe_item_id","payload_hash");--> statement-breakpoint
CREATE INDEX "wardrobe_items_user_id_idx" ON "wardrobe_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wardrobe_items_processing_status_idx" ON "wardrobe_items" USING btree ("processing_status");