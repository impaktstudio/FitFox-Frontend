import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const providerNameEnum = pgEnum("provider_name", [
  "postgres",
  "supabase",
  "railway",
  "gcs",
  "qdrant",
  "openrouter",
  "vertex",
  "posthog",
  "stripe",
  "gpu_backend",
  "mastra"
]);

export const providerRunStatusEnum = pgEnum("provider_run_status", ["success", "failed", "skipped"]);

export const processingStatusEnum = pgEnum("processing_status", ["pending", "processed", "failed"]);

export const profilePlanTierEnum = pgEnum("profile_plan_tier", ["free", "pro", "founder"]);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id").primaryKey(),
    city: text("city"),
    segment: text("segment"),
    signupSource: text("signup_source"),
    planTier: profilePlanTierEnum("plan_tier").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    ...timestamps
  },
  (table) => ({
    stripeCustomerIdx: index("profiles_stripe_customer_id_idx").on(table.stripeCustomerId)
  })
);

export const userStyleProfiles = pgTable(
  "user_style_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    primaryArchetype: text("primary_archetype").notNull().default("classic"),
    secondaryArchetype: text("secondary_archetype"),
    subArchetypes: jsonb("sub_archetypes").$type<string[] | null>(),
    trendSignals: jsonb("trend_signals").$type<string[] | null>(),
    valuesOverlay: jsonb("values_overlay").$type<Record<string, unknown>>().notNull().default({}),
    preferenceNotes: text("preference_notes"),
    ...timestamps
  },
  (table) => ({
    userIdx: index("user_style_profiles_user_id_idx").on(table.userId),
    userUniqueIdx: uniqueIndex("user_style_profiles_user_id_unique").on(table.userId)
  })
);

export const wardrobeItems = pgTable(
  "wardrobe_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    gcsObjectPath: text("gcs_object_path"),
    descriptionText: text("description_text"),
    manualTags: jsonb("manual_tags").$type<string[]>().notNull().default([]),
    category: text("category"),
    subcategory: text("subcategory"),
    colors: jsonb("colors").$type<string[]>().notNull().default([]),
    materials: jsonb("materials").$type<string[]>().notNull().default([]),
    silhouetteTags: jsonb("silhouette_tags").$type<string[]>().notNull().default([]),
    formalityTags: jsonb("formality_tags").$type<string[]>().notNull().default([]),
    archetypeTags: jsonb("archetype_tags").$type<string[]>().notNull().default([]),
    occasionTags: jsonb("occasion_tags").$type<string[]>().notNull().default([]),
    climateTags: jsonb("climate_tags").$type<string[]>().notNull().default([]),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    ...timestamps
  },
  (table) => ({
    userIdx: index("wardrobe_items_user_id_idx").on(table.userId),
    statusIdx: index("wardrobe_items_processing_status_idx").on(table.processingStatus)
  })
);

export const wardrobeItemMatchCandidates = pgTable(
  "wardrobe_item_match_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    wardrobeItemId: uuid("wardrobe_item_id").notNull(),
    candidateText: text("candidate_text").notNull(),
    payloadHash: text("payload_hash").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    userIdx: index("wardrobe_item_match_candidates_user_id_idx").on(table.userId),
    itemIdx: index("wardrobe_item_match_candidates_item_id_idx").on(table.wardrobeItemId),
    hashUniqueIdx: uniqueIndex("wardrobe_item_match_candidates_payload_hash_unique").on(
      table.userId,
      table.wardrobeItemId,
      table.payloadHash
    )
  })
);

export const qdrantPoints = pgTable(
  "qdrant_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    wardrobeItemId: uuid("wardrobe_item_id"),
    matchCandidateId: uuid("match_candidate_id"),
    collectionName: text("collection_name").notNull(),
    pointId: text("point_id").notNull(),
    vectorName: text("vector_name").notNull().default("splade_text"),
    payloadHash: text("payload_hash").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    userIdx: index("qdrant_points_user_id_idx").on(table.userId),
    itemIdx: index("qdrant_points_wardrobe_item_id_idx").on(table.wardrobeItemId),
    candidateIdx: index("qdrant_points_match_candidate_id_idx").on(table.matchCandidateId),
    pointUniqueIdx: uniqueIndex("qdrant_points_collection_point_unique").on(table.collectionName, table.pointId)
  })
);

export const occasionSessions = pgTable(
  "occasion_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    rawInput: text("raw_input"),
    occasionMode: text("occasion_mode"),
    desiredImpression: text("desired_impression"),
    climateState: text("climate_state"),
    city: text("city"),
    constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),
    selectedItemIds: jsonb("selected_item_ids").$type<string[]>().notNull().default([]),
    ...timestamps
  },
  (table) => ({
    userIdx: index("occasion_sessions_user_id_idx").on(table.userId)
  })
);

export const recommendationRuns = pgTable(
  "recommendation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    occasionSessionId: uuid("occasion_session_id"),
    mastraWorkflowRunId: text("mastra_workflow_run_id"),
    status: text("status").notNull().default("pending"),
    executionMode: text("execution_mode").notNull().default("local"),
    error: jsonb("error").$type<Record<string, unknown> | null>(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("recommendation_runs_user_id_idx").on(table.userId),
    sessionIdx: index("recommendation_runs_session_id_idx").on(table.occasionSessionId)
  })
);

export const generatedLooks = pgTable(
  "generated_looks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    recommendationRunId: uuid("recommendation_run_id").notNull(),
    occasionSessionId: uuid("occasion_session_id"),
    title: text("title").notNull(),
    itemIds: jsonb("item_ids").$type<string[]>().notNull().default([]),
    reasoning: text("reasoning").notNull().default(""),
    missingItemSuggestion: text("missing_item_suggestion"),
    refinementSuggestion: text("refinement_suggestion"),
    scores: jsonb("scores").$type<Record<string, number>>().notNull().default({}),
    totalScore: numeric("total_score", { precision: 5, scale: 2 }),
    rank: integer("rank"),
    generationContext: jsonb("generation_context").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    userIdx: index("generated_looks_user_id_idx").on(table.userId),
    lookRunIdx: index("generated_looks_recommendation_run_id_idx").on(table.recommendationRunId),
    sessionIdx: index("generated_looks_session_id_idx").on(table.occasionSessionId)
  })
);

export const savedLooks = pgTable(
  "saved_looks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    lookId: uuid("look_id").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("saved_looks_user_id_idx").on(table.userId),
    lookIdx: index("saved_looks_look_id_idx").on(table.lookId),
    userLookUniqueIdx: uniqueIndex("saved_looks_user_look_unique").on(table.userId, table.lookId)
  })
);

export const feedbackEvents = pgTable(
  "feedback_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    lookId: uuid("look_id"),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    userIdx: index("feedback_events_user_id_idx").on(table.userId),
    lookIdx: index("feedback_events_look_id_idx").on(table.lookId)
  })
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    lookId: uuid("look_id").notNull(),
    channel: text("channel").notNull(),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    userIdx: index("share_links_user_id_idx").on(table.userId),
    lookIdx: index("share_links_look_id_idx").on(table.lookId),
    tokenUniqueIdx: uniqueIndex("share_links_token_unique").on(table.token)
  })
);

export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("stripe_customers_user_id_idx").on(table.userId),
    userUniqueIdx: uniqueIndex("stripe_customers_user_id_unique").on(table.userId),
    customerUniqueIdx: uniqueIndex("stripe_customers_stripe_customer_id_unique").on(table.stripeCustomerId)
  })
);

export const stripeSubscriptions = pgTable(
  "stripe_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    userIdx: index("stripe_subscriptions_user_id_idx").on(table.userId),
    subscriptionUniqueIdx: uniqueIndex("stripe_subscriptions_subscription_id_unique").on(
      table.stripeSubscriptionId
    )
  })
);

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processed: boolean("processed").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => ({
    eventUniqueIdx: uniqueIndex("stripe_events_stripe_event_id_unique").on(table.stripeEventId)
  })
);

export const providerRuns = pgTable(
  "provider_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    routeName: text("route_name").notNull(),
    providerName: providerNameEnum("provider_name").notNull(),
    executionMode: text("execution_mode").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: providerRunStatusEnum("status").notNull(),
    requestPayload: jsonb("request_payload").$type<Record<string, unknown> | null>(),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown> | null>(),
    errorDetails: jsonb("error_details").$type<Record<string, unknown> | null>(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("provider_runs_user_id_idx").on(table.userId),
    providerIdx: index("provider_runs_provider_name_idx").on(table.providerName),
    statusIdx: index("provider_runs_status_idx").on(table.status)
  })
);

export type ProviderRunStatus = (typeof providerRunStatusEnum.enumValues)[number];
