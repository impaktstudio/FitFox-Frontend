# AGENTS

## Toolchain
- Use Node `25` (`.nvmrc`, `package.json` engines) and `npm`; this repo is locked with `package-lock.json`.
- Tailwind v4 is configured in CSS (`app/globals.css`) via `@tailwindcss/postcss`. There is no `tailwind.config.ts`.

## Commands
- Dev server: `npm run dev`
- Dev server with Railway env injection: `npm run dev:railway`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck` (`next typegen && tsc --noEmit`; do not replace with plain `tsc`)
- Full test suite: `npm test`
- Single test file: `npm test -- tests/feature-flags.test.ts`
- Test watch mode: `npm run test:watch`
- Build: `npm run build`
- Storybook dev: `npm run storybook`
- Storybook build: `npm run build-storybook`
- Chromatic dry run: `npm run chromatic:dry-run` (`CHROMATIC_PROJECT_TOKEN` absent => local Storybook build only)
- Drizzle generate/migrate: `npm run db:generate`, `npm run db:migrate`

## Verification Order
- The documented static verification flow is `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- `npm run lint` is separate and strict (`--max-warnings=0`). Run it when touching TS/JS files.

## Architecture
- This is a single Next.js App Router app, not a monorepo.
- UI entrypoint is `app/page.tsx`, which currently renders `components/foundation/foundation-status.tsx`.
- Most backend behavior lives in `app/api/**` route handlers backed by `lib/**` service modules.
- Keep API handlers on the `routeHandler` helper from `lib/api/handler.ts`; it standardizes `{ ok, data|error, meta.requestId }` responses and reports 5xx errors to Sentry.
- Existing API routes explicitly use `export const runtime = "nodejs"`; keep that for routes using Stripe, Inngest, Supabase, or other Node-only SDKs.
- Path alias `@/*` maps to `./*` in both `tsconfig.json` and `vitest.config.ts`.

## Backend Conventions
- Follow the ticket direction: keep the Next.js backend thin. Routes should only do auth, request parsing, ownership checks, orchestration, and response shaping; domain logic belongs in `lib/**`.
- Name files and symbols by domain noun plus action. Prefer `evaluateFeatureFlags`, `enqueueGpuWorkerTask`, `processStripeWebhookEvent`, `getReadinessReport`; avoid vague names like `handleData`, `utils`, `manager`, or `processor`.
- Keep route paths, table names, payload fields, and persisted JSON keys in the backend ticket vocabulary unless executable code already establishes a different contract. Prefer `userId` in TypeScript and `user_id` in database/API payloads only when matching an external or persisted contract.
- Split modules by responsibility, not by ticket. Good boundaries here are `route`, `service`, `provider adapter`, `store/persistence`, `schema`, and `types`.
- Prefer provider-specific adapters under `lib/**` over provider calls scattered across routes or workflows. The tickets expect interchangeable paths for PostHog, Stripe, OpenRouter, Qdrant, Inngest, Supabase, and future GPU backends.
- Keep local/test generic paths and remote provider paths behind the same contract. Fallbacks should satisfy downstream schemas, not return ad hoc shapes.
- Design writes and external side effects to be idempotent. Tickets repeatedly require duplicate-safe behavior for Stripe events, GPU task dispatch, saves, migrations, and indexing.
- Enforce user ownership at the boundary before reads, writes, indexing, or workflow execution. Many ticket acceptance criteria depend on never crossing user data.
- Prefer deterministic functions for scoring, ranking, refinement, and fallback generation. If tie-breaking matters, encode it explicitly.
- Add small typed schemas close to boundaries. Validate request payloads, route params, provider payloads, and structured model output before persistence.
- Reuse existing audit/analytics patterns for external calls. New provider integrations should be observable through `provider_runs` and should fail without breaking core flows when the ticket says local/test mode must degrade gracefully.

## Auth And Env
- `.env.example` defaults local auth to `AUTH_MODE=test` and `TEST_AUTH_USER_ID=00000000-0000-4000-8000-000000000001`.
- Test auth can be overridden only in local/test via `x-fitfox-test-user-id`; production-like envs reject that header.
- `AUTH_MODE=supabase` requires a bearer token or Supabase auth cookies; missing auth is a real 401 path, not a local fallback.
- Environment parsing is centralized in `lib/config/env.ts`; preserve its Zod validation and provider-readiness semantics instead of reading raw `process.env` ad hoc.

## Supabase Flow
- `proxy.ts` at the repo root is the session refresh hook. `lib/supabase/server.ts` notes that route auth validation cannot mutate cookies; `proxy.ts` must run before handlers for cookie refresh.

## Feature Flags And Observability
- PostHog is the runtime feature-flag source of truth.
- Local/test fallback values live in `lib/feature-flags/defaults.ts`; do not add env-driven feature flag logic.
- Browser PostHog uses `/ingest`; keep `instrumentation-client.ts` and the `/ingest` rewrites in `next.config.ts` aligned.
- Sentry is wired through `instrumentation.ts`, `instrumentation-client.ts`, and `withSentryConfig(...)` in `next.config.ts`; preserve all three when changing observability setup.

## Data Layer
- Drizzle schema source is `lib/db/schema.ts`; generated SQL migrations live in `drizzle/`.
- `npm run db:migrate` uses `DATABASE_URL` and falls back to `postgres://postgres:postgres@localhost:5432/fitfox` if unset.

## Tests And Stories
- Vitest runs in `jsdom` and only picks up `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- Storybook is `@storybook/nextjs-vite` and only loads `stories/**/*.stories.@(ts|tsx)`, not component-local `*.stories.tsx` files.
