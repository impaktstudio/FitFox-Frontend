CREATE TYPE "provider_name" AS ENUM ('postgres', 'gcs', 'qdrant', 'vertex', 'posthog', 'stripe', 'gpu_backend', 'mastra');
CREATE TYPE "provider_run_status" AS ENUM ('success', 'failed', 'skipped');
CREATE TYPE "processing_status" AS ENUM ('pending', 'processed', 'failed');
CREATE TYPE "profile_plan_tier" AS ENUM ('free', 'pro', 'founder');

CREATE TABLE "profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "city" text,
  "segment" text,
  "signup_source" text,
  "plan_tier" "profile_plan_tier" DEFAULT 'free' NOT NULL,
  "stripe_customer_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE "saved_looks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "look_id" uuid NOT NULL,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "feedback_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "look_id" uuid,
  "event_type" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE "stripe_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stripe_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text NOT NULL,
  "status" text NOT NULL,
  "current_period_end" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stripe_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "processed" boolean DEFAULT false NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE INDEX "profiles_stripe_customer_id_idx" ON "profiles" ("stripe_customer_id");
CREATE INDEX "user_style_profiles_user_id_idx" ON "user_style_profiles" ("user_id");
CREATE UNIQUE INDEX "user_style_profiles_user_id_unique" ON "user_style_profiles" ("user_id");
CREATE INDEX "wardrobe_items_user_id_idx" ON "wardrobe_items" ("user_id");
CREATE INDEX "wardrobe_items_processing_status_idx" ON "wardrobe_items" ("processing_status");
CREATE INDEX "wardrobe_item_match_candidates_user_id_idx" ON "wardrobe_item_match_candidates" ("user_id");
CREATE INDEX "wardrobe_item_match_candidates_item_id_idx" ON "wardrobe_item_match_candidates" ("wardrobe_item_id");
CREATE UNIQUE INDEX "wardrobe_item_match_candidates_payload_hash_unique" ON "wardrobe_item_match_candidates" ("user_id", "wardrobe_item_id", "payload_hash");
CREATE INDEX "qdrant_points_user_id_idx" ON "qdrant_points" ("user_id");
CREATE INDEX "qdrant_points_wardrobe_item_id_idx" ON "qdrant_points" ("wardrobe_item_id");
CREATE INDEX "qdrant_points_match_candidate_id_idx" ON "qdrant_points" ("match_candidate_id");
CREATE UNIQUE INDEX "qdrant_points_collection_point_unique" ON "qdrant_points" ("collection_name", "point_id");
CREATE INDEX "occasion_sessions_user_id_idx" ON "occasion_sessions" ("user_id");
CREATE INDEX "recommendation_runs_user_id_idx" ON "recommendation_runs" ("user_id");
CREATE INDEX "recommendation_runs_session_id_idx" ON "recommendation_runs" ("occasion_session_id");
CREATE INDEX "generated_looks_user_id_idx" ON "generated_looks" ("user_id");
CREATE INDEX "generated_looks_recommendation_run_id_idx" ON "generated_looks" ("recommendation_run_id");
CREATE INDEX "generated_looks_session_id_idx" ON "generated_looks" ("occasion_session_id");
CREATE INDEX "saved_looks_user_id_idx" ON "saved_looks" ("user_id");
CREATE INDEX "saved_looks_look_id_idx" ON "saved_looks" ("look_id");
CREATE UNIQUE INDEX "saved_looks_user_look_unique" ON "saved_looks" ("user_id", "look_id");
CREATE INDEX "feedback_events_user_id_idx" ON "feedback_events" ("user_id");
CREATE INDEX "feedback_events_look_id_idx" ON "feedback_events" ("look_id");
CREATE INDEX "share_links_user_id_idx" ON "share_links" ("user_id");
CREATE INDEX "share_links_look_id_idx" ON "share_links" ("look_id");
CREATE UNIQUE INDEX "share_links_token_unique" ON "share_links" ("token");
CREATE INDEX "stripe_customers_user_id_idx" ON "stripe_customers" ("user_id");
CREATE UNIQUE INDEX "stripe_customers_user_id_unique" ON "stripe_customers" ("user_id");
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_unique" ON "stripe_customers" ("stripe_customer_id");
CREATE INDEX "stripe_subscriptions_user_id_idx" ON "stripe_subscriptions" ("user_id");
CREATE UNIQUE INDEX "stripe_subscriptions_subscription_id_unique" ON "stripe_subscriptions" ("stripe_subscription_id");
CREATE UNIQUE INDEX "stripe_events_stripe_event_id_unique" ON "stripe_events" ("stripe_event_id");
CREATE INDEX "provider_runs_user_id_idx" ON "provider_runs" ("user_id");
CREATE INDEX "provider_runs_provider_name_idx" ON "provider_runs" ("provider_name");
CREATE INDEX "provider_runs_status_idx" ON "provider_runs" ("status");
