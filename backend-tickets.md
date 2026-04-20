# FitFox MVP Backend Tickets

These tickets translate the MVP backend plan into Sprint 1 epics for a Next.js thin API backed by Postgres, GCS, Qdrant Cloud, OpenRouter, Mastra, PostHog, and Stripe.

The GPU worker is a separate execution space for high-intensity, low-duration jobs such as Qwen Image 2512 image generation, SAM segmentation, and SPLADE++ processing. GPU-specific implementation tickets live in `gpu-tickets/`.

## Scope Rules

- Keep the Next.js backend thin: route validation, auth/test identity, orchestration calls, persistence, feature flags, and provider adapters.
- Use Qdrant Cloud inference as the default sparse embedding/search path for Sprint 1.
- Add an interface for the GPU backend, but do not require GPU worker implementation for app-side Sprint 1 completion.
- Use local/test feature flags to run without Supabase auth, OpenRouter, Qdrant, Stripe, or GPU worker in local development.
- Do not implement broad social commerce, full closet digitization, try-on, or dense/hybrid reranking in Sprint 1.

## Epic 1: Next.js API Foundation

### BE-01: Scaffold Next.js API Route Foundation

**Description**  
Create the backend route structure in `app/api/**/route.ts` with shared response helpers, request validation, typed errors, and `runtime = "nodejs"` for provider SDK compatibility.

**Required API Endpoints**
- `GET /api/health`
- `GET /api/ready`

**Required Data Models**
- None.

**Technical Acceptance Criteria**
- `/api/health` returns `200` with service name, version, and environment.
- `/api/ready` returns provider readiness for Postgres, GCS config, Qdrant config, OpenRouter config, PostHog config, Stripe config, and GPU backend config.
- Route handlers use a consistent success/error response shape.
- Zod validation utilities exist for request bodies, query params, and route params.

**Smoke Tests**
- `GET /api/health` returns `200`.
- `GET /api/ready` returns `200` in local mode with missing remote providers marked as disabled, not failed.

**Unit Tests**
- Response helper formats success and error bodies consistently.
- Env parser rejects invalid enum values but allows missing remote secrets in local/test mode.

**Dependencies**
- None.

### BE-02: Add Test Auth Environment Mode

**Description**  
Add an environment-controlled auth mode so backend routes can be developed and tested before Supabase auth middleware is implemented. Supabase auth middleware is explicitly not part of this ticket.

**Required API Endpoints**
- Applies to all protected API routes.

**Required Data Models**
- `profiles`
  - `user_id`
  - `city`
  - `segment`
  - `signup_source`
  - `plan_tier`
  - `stripe_customer_id`
  - `created_at`
  - `updated_at`

**Technical Acceptance Criteria**
- Add `AUTH_MODE=test|supabase`.
- Add `TEST_AUTH_USER_ID`.
- When `AUTH_MODE=test`, protected routes resolve `user_id` from `TEST_AUTH_USER_ID` or an allowed test header.
- When `AUTH_MODE=supabase`, routes return `501` or a typed `auth_not_implemented` error until Supabase middleware is implemented in a later ticket.
- No route silently falls back to anonymous access.

**Smoke Tests**
- With `AUTH_MODE=test`, a protected route resolves the test user.
- With `AUTH_MODE=supabase`, a protected route returns the typed not-implemented auth error.

**Unit Tests**
- Missing `TEST_AUTH_USER_ID` fails in test mode.
- Unknown `AUTH_MODE` fails config validation.
- Test header override is disabled outside local/test environments.

**Dependencies**
- BE-01.

### BE-03: Add Postgres Schema And Drizzle Migrations

**Description**  
Create the core Postgres schema and Drizzle migration setup for product data, provider runs, billing state, and recommendation persistence.

**Required API Endpoints**
- None directly.

**Required Data Models**
- `profiles`
- `user_style_profiles`
- `wardrobe_items`
- `wardrobe_item_match_candidates`
- `qdrant_points`
- `occasion_sessions`
- `recommendation_runs`
- `generated_looks`
- `saved_looks`
- `feedback_events`
- `share_links`
- `stripe_customers`
- `stripe_subscriptions`
- `stripe_events`
- `provider_runs`

**Technical Acceptance Criteria**
- Tables use UUID primary keys where applicable.
- User-owned tables include `user_id` and indexes on `user_id`.
- Recommendation lookup tables include indexes on `session_id`, `look_id`, and `wardrobe_item_id` where relevant.
- `provider_runs` can audit OpenRouter, Qdrant, GPU backend, Stripe, PostHog, and GCS operations.
- Migrations are idempotent in local dev.

**Smoke Tests**
- Migration applies to a local or test Postgres database.
- Insert/select succeeds for profile, wardrobe item, session, generated look, and feedback event.

**Unit Tests**
- Drizzle schema types serialize JSON fields correctly.
- Enum-like fields reject unsupported values at validation layer.

**Dependencies**
- BE-01.

### BE-04: Feature Flag Service With PostHog And Env Fallback

**Description**  
Implement a server-side feature flag service that reads PostHog flags when configured and falls back to env defaults locally.

**Required API Endpoints**
- `GET /api/feature-flags`

**Required Data Models**
- None.

**Technical Acceptance Criteria**
- Supports these flags:
  - `backend-use-local-processing`
  - `backend-use-gpu-worker`
  - `backend-use-qdrant-sparse`
  - `backend-use-openrouter`
  - `backend-use-mastra-workflow`
  - `billing-stripe-enabled`
- PostHog failures fall back to env defaults.
- The route returns the evaluated flags for the authenticated/test user.

**Smoke Tests**
- In local mode, route returns env-backed flags.
- With PostHog disabled, provider failure does not fail the route.

**Unit Tests**
- Remote flag values override env defaults when PostHog is configured.
- Unknown flags are ignored unless explicitly requested by code.

**Dependencies**
- BE-02.

### BE-05: Observability And Provider Run Logging

**Description**  
Add analytics and provider audit wrappers for PostHog, Sentry/server logs, and `provider_runs`.

**Required API Endpoints**
- None directly.

**Required Data Models**
- `provider_runs`

**Technical Acceptance Criteria**
- Wrapper captures route name, user ID, provider name, execution mode, latency, status, and error details.
- PostHog events can be disabled in local/test mode.
- Failed analytics calls never break core product flow.

**Smoke Tests**
- A test event can be emitted in local mode without remote PostHog.
- A mocked provider failure creates a failed `provider_runs` row.

**Unit Tests**
- Provider run logging redacts secrets and large payloads.
- Analytics wrapper includes expected event properties.

**Dependencies**
- BE-03, BE-04.

## Epic 2: Storage, Wardrobe, And Item Understanding

### BE-06: GCS Signed Wardrobe Image Uploads

**Description**  
Create signed upload URL support for wardrobe images. This ticket must be paired with the Qdrant Cloud indexing ticket so uploaded images can flow into item understanding, embedding, PSQL persistence, and Qdrant storage.

**Required API Endpoints**
- `POST /api/uploads/wardrobe-image`

**Required Data Models**
- `wardrobe_items`
- `provider_runs`

**Technical Acceptance Criteria**
- Authenticated/test user receives a short-lived signed GCS upload URL and deterministic object path.
- Object paths are scoped by `user_id`.
- Route validates file MIME type, extension, and declared byte size.
- Route records a `provider_runs` audit row for GCS signed URL generation.
- Output includes enough metadata for `POST /api/wardrobe-items` to attach the uploaded image.

**Smoke Tests**
- Request returns signed URL and GCS object path.
- Invalid MIME type returns `400`.

**Unit Tests**
- Object path cannot escape the user prefix.
- Signed URL expiration is bounded.

**Dependencies**
- BE-02, BE-03.

### BE-07: Wardrobe Item Create And List Routes

**Description**  
Persist lightweight wardrobe item records from GCS object paths and optional text descriptions. This is not full closet digitization.

**Required API Endpoints**
- `POST /api/wardrobe-items`
- `GET /api/wardrobe-items`

**Required Data Models**
- `wardrobe_items`

**Technical Acceptance Criteria**
- Create route accepts `gcs_object_path`, `description_text`, and `manual_tags`.
- List route returns only current user items.
- New items start with `processing_status = pending` unless local/test mode is configured to pass generic values.
- Generic values are allowed in local/test mode when provider work is unavailable.

**Smoke Tests**
- Create item then list item for same user.
- Another test user cannot list the item.

**Unit Tests**
- Requires at least one of `gcs_object_path` or `description_text`.
- Manual tags are normalized into structured fields when supplied.

**Dependencies**
- BE-06.

### BE-08: OpenRouter Item Understanding Adapter

**Description**  
Add an OpenRouter adapter for image/text item understanding. In local/test mode, return generic structured values without calling OpenRouter.

**Required API Endpoints**
- Used by `POST /api/wardrobe-items`.

**Required Data Models**
- `wardrobe_items`
- `provider_runs`

**Technical Acceptance Criteria**
- Remote mode calls OpenRouter with the item image and/or description.
- Local/test mode returns generic structured values that satisfy downstream contracts.
- Structured output includes category, subcategory, colors, materials, silhouette tags, formality tags, archetype tags, occasion tags, climate tags, and description text.
- Provider success/failure is captured in `provider_runs`.

**Smoke Tests**
- Local/test item create stores generic structured fields.
- Mocked OpenRouter response updates item from `pending` to `processed`.

**Unit Tests**
- Malformed OpenRouter output marks item as `failed`.
- Generic fallback does not invent unsupported business claims.

**Dependencies**
- BE-07.

## Epic 3: Qdrant Cloud Sparse Match Indexing

### BE-09: Moved To GPU Ticket Space

**Description**  
BE-09 is intentionally not implemented in the Next.js backend ticket space. The high-intensity worker responsibilities for Qwen Image 2512 generation, SAM, and SPLADE++ live in `gpu-tickets/`.

**Required API Endpoints**
- None in the Next.js backend.

**Required Data Models**
- None in the Next.js backend.

**Technical Acceptance Criteria**
- Backend references GPU capabilities only through interfaces/adapters.
- No GPU worker implementation code is added under the Next.js API app for this ticket.

**Smoke Tests**
- Not applicable.

**Unit Tests**
- Not applicable.

**Dependencies**
- See `gpu-tickets/README.md`.

### BE-10: Reserved - Do Not Implement GPU Worker In App Backend

**Description**  
Do not implement a concrete GPU worker skeleton in the Next.js backend. Add only generic config placeholders and typed interfaces needed by app-side adapters.

**Required API Endpoints**
- None.

**Required Data Models**
- None.

**Technical Acceptance Criteria**
- Add generic config keys for GPU backend base URL, auth token, and enabled mode.
- Add TypeScript interfaces for GPU backend requests/responses.
- Do not create a FastAPI worker, worker Dockerfile, GPU model loader, or model-specific worker route in the app backend.
- Local/test paths return generic values where needed.

**Smoke Tests**
- App starts without GPU backend config in local/test mode.

**Unit Tests**
- Remote mode validates GPU backend base URL and token.
- Local/test mode does not require GPU backend config.

**Dependencies**
- BE-01, BE-04.

### BE-11: Qdrant Cloud Inference Adapter With GPU Backend Interface

**Description**  
Implement the app-side sparse retrieval adapter using Qdrant Cloud inference as the default path. Also define an interchangeable GPU backend interface for future or flagged SPLADE++ processing.

**Required API Endpoints**
- Used internally by match indexing and recommendation retrieval.

**Required Data Models**
- `wardrobe_item_match_candidates`
- `qdrant_points`
- `provider_runs`

**Technical Acceptance Criteria**
- Adapter can create or verify the `fitfox_match_candidates_v1` collection.
- Adapter supports sparse vector name `splade_text`.
- Default remote path uses Qdrant Cloud inference for embedding/search.
- GPU backend path is defined behind feature flags but not required for Sprint 1 app-side success.
- Query and upsert calls support filtering by `user_id`.
- Provider calls are audited in `provider_runs`.

**Smoke Tests**
- With Qdrant configured, collection verification succeeds.
- In local/test mode, adapter returns generic sparse-search results without remote calls.

**Unit Tests**
- Collection setup is idempotent.
- User filter is always included in search calls.
- GPU interface request/response types match the contract in `gpu-tickets/`.

**Dependencies**
- BE-03, BE-04, BE-10.

### BE-12: Qdrant Match Candidate Persistence And Indexing

**Description**  
Pair GCS-uploaded wardrobe items with generated match candidates, persist those candidates in Postgres, and index them in Qdrant Cloud. This ticket depends on BE-11.

**Required API Endpoints**
- `POST /api/wardrobe-items/[itemId]/matches`

**Required Data Models**
- `wardrobe_items`
- `wardrobe_item_match_candidates`
- `qdrant_points`
- `provider_runs`

**Technical Acceptance Criteria**
- Route loads the user-owned wardrobe item.
- Route generates or accepts match candidate text for the item.
- Candidate text is persisted in `wardrobe_item_match_candidates`.
- Candidate vectors are stored in Qdrant Cloud through BE-11.
- Qdrant point metadata is persisted in `qdrant_points`.
- Route supports local/test generic candidate values.

**Smoke Tests**
- Create uploaded item, call match indexing route, and receive candidate IDs plus Qdrant point IDs or local generic equivalents.

**Unit Tests**
- Rejects item IDs not owned by the current user.
- Retries or records failed indexing without duplicating persisted candidates.
- Payload hash prevents duplicate Qdrant point records for the same candidate.

**Dependencies**
- BE-06, BE-07, BE-08, BE-11.

## Epic 4: Mastra Recommendation Workflow

### BE-13: Mastra And Postgres Workflow Storage

**Description**  
Configure Mastra workflow orchestration with Postgres persistence for recommendation runs.

**Required API Endpoints**
- Used internally by `POST /api/recommendations`.

**Required Data Models**
- `recommendation_runs`
- Mastra-managed workflow storage tables

**Technical Acceptance Criteria**
- Mastra storage uses the same Postgres environment as the app.
- Workflow run IDs are recorded in `recommendation_runs`.
- Next.js dev mode avoids duplicate Mastra initialization.
- Local/test mode can bypass Mastra and call a generic orchestrator if the flag is disabled.

**Smoke Tests**
- A test workflow run persists and can be retrieved.

**Unit Tests**
- Disabled Mastra flag routes to local generic orchestrator.
- Failed workflow run is recorded with status and error.

**Dependencies**
- BE-03, BE-04.

### BE-14: Occasion Interpreter Step

**Description**  
Parse user occasion input into structured context for recommendation generation.

**Required API Endpoints**
- Used by `POST /api/recommendations`.

**Required Data Models**
- `occasion_sessions`
- `provider_runs`

**Technical Acceptance Criteria**
- Accepts raw occasion text, desired impression, climate state, city, constraints, and selected item IDs.
- Produces occasion mode, desired impression, climate state, constraints, and city.
- Local/test mode returns generic structured values.
- OpenRouter calls are audited in `provider_runs`.

**Smoke Tests**
- Birthday dinner input creates a structured occasion session.

**Unit Tests**
- Missing optional fields do not fail the step.
- Invalid climate or city is normalized or rejected with typed error.

**Dependencies**
- BE-13.

### BE-15: Match Retrieval Step

**Description**  
Build a sparse retrieval query from occasion, style profile, wardrobe items, and feedback memory, then retrieve Qdrant match candidates through BE-11.

**Required API Endpoints**
- Used by `POST /api/recommendations`.

**Required Data Models**
- `wardrobe_items`
- `wardrobe_item_match_candidates`
- `qdrant_points`
- `feedback_events`

**Technical Acceptance Criteria**
- Retrieval query includes occasion mode, desired impression, climate, selected item descriptions, archetype fields, and feedback memory.
- Qdrant search is filtered by user ID.
- No matches still allows the recommendation flow to continue with owned item data.
- Local/test mode returns generic matches.

**Smoke Tests**
- Recommendation flow can retrieve indexed candidates for a selected item.

**Unit Tests**
- Retrieval never returns another user's candidates.
- Zero-result search returns an empty match list, not a failed workflow.

**Dependencies**
- BE-11, BE-12, BE-14.

### BE-16: Style Profile Read And Update Routes

**Description**  
Expose lightweight style profile read/update support for archetype-led recommendations.

**Required API Endpoints**
- `GET /api/me/style-profile`
- `PATCH /api/me/style-profile`

**Required Data Models**
- `user_style_profiles`

**Technical Acceptance Criteria**
- Read route auto-creates a generic profile when missing.
- Patch route allows primary archetype, secondary archetype, values overlay, preference notes, sub-archetype placeholders, and trend signal placeholders.
- Sub-archetypes and trends are nullable/freeform placeholders until their taxonomy is defined later.

**Smoke Tests**
- Get missing profile returns generic profile.
- Patch then get returns updated archetype fields.

**Unit Tests**
- Unsupported primary archetypes are rejected.
- Sub-archetype and trend placeholders persist without requiring a taxonomy.

**Dependencies**
- BE-03, BE-02.

### BE-17: Candidate Look Generation Step

**Description**  
Generate three to five complete outfit candidates from owned items first, enriched by retrieved match candidates and archetype context.

**Required API Endpoints**
- Used by `POST /api/recommendations`.

**Required Data Models**
- `generated_looks`
- `provider_runs`

**Technical Acceptance Criteria**
- Generation includes primary archetype, secondary archetype, sub-archetype placeholder, trend signal placeholders, values overlay, occasion mode, climate, and selected item context.
- Output includes title, item IDs, reasoning, optional missing item suggestion, and candidate rank seed.
- Uses owned items first.
- Local/test mode returns generic candidate looks.

**Smoke Tests**
- A recommendation run returns three generic looks in local/test mode.

**Unit Tests**
- Output parser rejects disconnected item fragments.
- Trend placeholders may be empty but must be present in the generation context.

**Dependencies**
- BE-15, BE-16.

### BE-18: Deterministic Legibility Scoring Service

**Description**  
Score candidate looks using the FitFox seven-dimension legibility framework.

**Required API Endpoints**
- Used by `POST /api/recommendations`.

**Required Data Models**
- `generated_looks.scores`
- `generated_looks.total_score`

**Technical Acceptance Criteria**
- Scores each candidate on:
  - Occasion Fit
  - Archetype Clarity
  - Proportion Coherence
  - Palette Coherence
  - Surface Alignment
  - Hierarchy
  - Finish Resolution
- Computes weighted total score from the framework.
- Applies hard gates for weak occasion fit, weak archetype clarity, and unfinished hierarchy/finish combinations.
- Sorts candidates deterministically.

**Smoke Tests**
- A generated recommendation run returns scores for all looks.

**Unit Tests**
- Weighted score formula is correct.
- Hard gates downgrade invalid looks.
- Ties sort consistently.

**Dependencies**
- BE-17.

### BE-19: Candidate Generation Context Includes Archetypes, Sub-Archetypes, And Trends

**Description**  
Extend generation context and persistence to carry archetypes, sub-archetypes, and trend signals. Sub-archetype and trend taxonomies will be defined later, so this ticket only creates safe placeholders and contract support.

**Required API Endpoints**
- Used by `POST /api/recommendations`
- `GET/PATCH /api/me/style-profile`

**Required Data Models**
- `user_style_profiles`
- `occasion_sessions`
- `generated_looks`

**Technical Acceptance Criteria**
- Generation context includes `primary_archetype`, `secondary_archetype`, `sub_archetypes`, and `trend_signals`.
- `sub_archetypes` and `trend_signals` are nullable arrays or JSON fields.
- No business logic depends on a completed taxonomy.
- Generated look records preserve the context used to generate them.

**Smoke Tests**
- Recommendation request succeeds when sub-archetypes and trend signals are absent.
- Recommendation request persists supplied trend signal placeholders.

**Unit Tests**
- Empty trend list is valid.
- Freeform trend values are length-limited and sanitized.

**Dependencies**
- BE-16, BE-17.

### BE-20: Recommendation API Route

**Description**  
Implement `POST /api/recommendations` as the thin API entrypoint that starts the Mastra recommendation workflow or local generic orchestrator.

**Required API Endpoints**
- `POST /api/recommendations`

**Required Data Models**
- `occasion_sessions`
- `recommendation_runs`
- `generated_looks`
- `provider_runs`

**Technical Acceptance Criteria**
- Route validates the request payload.
- Route enforces user ownership of selected item IDs.
- Route invokes Mastra when `backend-use-mastra-workflow` is enabled.
- Route uses local generic orchestration when Mastra is disabled.
- Route returns ranked looks with title, item IDs, reasoning, scores, refinement suggestion, and optional missing item suggestion.

**Smoke Tests**
- Authenticated/test request returns ranked looks in local/test mode.

**Unit Tests**
- Invalid item IDs are rejected.
- Provider failure returns typed error and records failed run.

**Dependencies**
- BE-13 through BE-19.

### BE-21: User-Guided Or Deterministic Refinement Step

**Description**  
Refine top looks using explicit user feedback when provided. If the user does not say what to improve, refine deterministically from the lowest scoring legibility dimension.

**Required API Endpoints**
- Used by `POST /api/recommendations`
- Used by `POST /api/looks/[lookId]/feedback`

**Required Data Models**
- `generated_looks`
- `feedback_events`

**Technical Acceptance Criteria**
- Accepts optional user feedback such as "make it less formal", "more sexy", "more comfortable", or "better for rain".
- If feedback is present, refinement uses that preference as the primary improvement target when it does not violate occasion fit.
- If no feedback is present, refinement targets the lowest scoring dimension, tie-breaking by framework weight.
- Refinement preserves the strongest working elements of the look.
- Local/test mode returns a generic refinement suggestion.

**Smoke Tests**
- Recommendation run returns deterministic refinement suggestions without user feedback.
- Feedback-driven refinement request changes the refinement target.

**Unit Tests**
- User feedback cannot force a look to violate hard gates.
- Lowest score tie breaks by framework weight.
- Empty feedback uses deterministic fallback.

**Dependencies**
- BE-18, BE-20.

## Epic 5: Memory, Sharing, And Metrics

### BE-22: Feedback Event Route

**Description**  
Capture save, share, wear, reject, buy-skip, and refine events against looks.

**Required API Endpoints**
- `POST /api/looks/[lookId]/feedback`

**Required Data Models**
- `feedback_events`
- `saved_looks`

**Technical Acceptance Criteria**
- Valid event types: `saved`, `shared`, `worn`, `rejected`, `buy_skip`, `refined`.
- Event metadata can include channel, comment, refinement feedback, purchase intent, and confidence rating.
- Save events create or reuse a `saved_looks` record.
- Events emit PostHog metrics.

**Smoke Tests**
- Submit saved feedback and verify feedback + saved look rows exist.

**Unit Tests**
- Invalid event type returns `400`.
- Duplicate save is idempotent.
- User cannot submit feedback on another user's look.

**Dependencies**
- BE-20, BE-21.

### BE-23: Saved Looks Route

**Description**  
Return the user's saved looks for repeat usage and memory.

**Required API Endpoints**
- `GET /api/saved-looks`

**Required Data Models**
- `saved_looks`
- `generated_looks`

**Technical Acceptance Criteria**
- Returns saved looks ordered by newest first.
- Includes occasion mode, title, item IDs, reasoning, scores, and saved timestamp.
- Only returns current user's saved looks.

**Smoke Tests**
- Save a look, then list saved looks.

**Unit Tests**
- User isolation is enforced.
- Empty saved looks list returns `[]`.

**Dependencies**
- BE-22.

### BE-24: Share Link Route

**Description**  
Create share tokens for WhatsApp, Instagram, and copy-link flows.

**Required API Endpoints**
- `POST /api/looks/[lookId]/share-links`

**Required Data Models**
- `share_links`
- `feedback_events`

**Technical Acceptance Criteria**
- Supports `whatsapp`, `instagram`, and `copy_link`.
- Generates unique share token.
- Records intended channel.
- Emits share metric event.
- Does not implement broad social commerce.

**Smoke Tests**
- Create WhatsApp share link for a look.

**Unit Tests**
- Invalid channel returns `400`.
- Token uniqueness is enforced.

**Dependencies**
- BE-20, BE-22.

### BE-25: PostHog Metrics Events

**Description**  
Emit backend product events needed for MVP validation metrics and feature flag analysis.

**Required API Endpoints**
- Applies across backend routes.

**Required Data Models**
- `provider_runs`

**Technical Acceptance Criteria**
- Emits:
  - `onboarding_item_uploaded`
  - `wardrobe_item_processed`
  - `wardrobe_item_match_indexed`
  - `occasion_session_started`
  - `occasion_session_completed`
  - `look_saved`
  - `look_shared`
  - `look_refined`
  - `purchase_advice_requested`
  - `upgrade_started`
  - `upgrade_completed`
- Event properties include `user_id`, city when known, occasion type when known, execution mode, and relevant IDs.

**Smoke Tests**
- Local/test analytics wrapper accepts all event names.

**Unit Tests**
- Event payloads match the expected contract.
- Disabled PostHog does not break route execution.

**Dependencies**
- BE-05, BE-12, BE-20, BE-22.

## Epic 6: Stripe Billing

### BE-26: Stripe Customer Mapping

**Description**  
Create or reuse a Stripe customer for the authenticated/test user.

**Required API Endpoints**
- Used by billing routes.

**Required Data Models**
- `profiles`
- `stripe_customers`
- `provider_runs`

**Technical Acceptance Criteria**
- Existing Stripe customer is reused.
- New customer is created when missing and Stripe is enabled.
- Local/test mode returns generic customer ID when Stripe is disabled.

**Smoke Tests**
- Test user receives a customer ID.

**Unit Tests**
- Duplicate customer creation is prevented.
- Stripe disabled path returns generic values only in local/test mode.

**Dependencies**
- BE-03, BE-04.

### BE-27: Stripe Checkout Route

**Description**  
Create hosted Stripe Checkout Sessions for subscription signup.

**Required API Endpoints**
- `POST /api/billing/checkout`

**Required Data Models**
- `stripe_customers`
- `provider_runs`

**Technical Acceptance Criteria**
- Supports known plan IDs from env configuration.
- Emits `upgrade_started`.
- Returns Stripe Checkout URL in remote mode.
- Returns generic URL in local/test mode when billing is disabled.

**Smoke Tests**
- Test mode checkout returns a URL.

**Unit Tests**
- Invalid plan rejected.
- Missing Stripe config rejected when billing flag is enabled.

**Dependencies**
- BE-26.

### BE-28: Stripe Billing Portal Route

**Description**  
Create Stripe Billing Portal Sessions for subscription management.

**Required API Endpoints**
- `POST /api/billing/portal`

**Required Data Models**
- `stripe_customers`
- `provider_runs`

**Technical Acceptance Criteria**
- Requires existing Stripe customer.
- Returns portal URL in remote mode.
- Returns typed error if no customer exists.

**Smoke Tests**
- Existing test customer receives portal URL.

**Unit Tests**
- Missing customer returns typed error.
- Stripe disabled behavior follows billing flag.

**Dependencies**
- BE-26.

### BE-29: Stripe Webhook Route

**Description**  
Verify Stripe webhook signatures and sync subscription state.

**Required API Endpoints**
- `POST /api/stripe/webhook`

**Required Data Models**
- `stripe_events`
- `stripe_subscriptions`
- `profiles`
- `provider_runs`

**Technical Acceptance Criteria**
- Verifies webhook signature before parsing event.
- Persists Stripe event ID for idempotency.
- Handles subscription created, updated, deleted, invoice paid, and invoice payment failed.
- Updates profile `plan_tier` from subscription state.
- Emits `upgrade_completed` when relevant.

**Smoke Tests**
- Stripe CLI test webhook updates subscription table.

**Unit Tests**
- Bad signature rejected.
- Replayed event is idempotent.
- Unknown event type is safely ignored.

**Dependencies**
- BE-27.
