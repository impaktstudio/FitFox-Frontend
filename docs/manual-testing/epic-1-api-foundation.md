# Epic 1 API Foundation Manual Testing

## 1. Environment setup

Create a local env file:

```bash
cp .env.example .env.local
```

Keep `AUTH_MODE=test` and `TEST_AUTH_USER_ID=00000000-0000-4000-8000-000000000001` for local smoke testing.

Install dependencies:

```bash
npm install
```

## 2. Static verification

```bash
npm run typecheck
npm test
npm run build
npm run build-storybook
```

Expected result: all commands complete successfully. Storybook may emit large chunk warnings; those are acceptable for this foundation pass.

## 3. API smoke tests

Start the app:

```bash
npm run dev
```

Health:

```bash
curl -s http://localhost:3000/api/health | jq
```

Expected:

- HTTP `200`
- `ok: true`
- `data.service`
- `data.version`
- `data.environment`

Readiness:

```bash
curl -s http://localhost:3000/api/ready | jq
```

Expected:

- HTTP `200`
- local missing providers such as GCS, Qdrant, Vertex, Stripe, GPU backend, and Mastra are `disabled`, not `failed`
- configured providers report `configured`

## 4. Test auth mode

Default test user:

```bash
curl -s http://localhost:3000/api/auth/smoke | jq
```

Expected:

- HTTP `200`
- `data.authenticated: true`
- `data.auth.userId` equals `TEST_AUTH_USER_ID`
- `data.auth.source: "test_env"`

Header override in local/test:

```bash
curl -s \
  -H 'x-fitfox-test-user-id: 00000000-0000-4000-8000-000000000002' \
  http://localhost:3000/api/auth/smoke | jq
```

Expected:

- HTTP `200`
- `data.auth.userId` equals the header UUID
- `data.auth.source: "test_header"`

Supabase placeholder mode:

```bash
AUTH_MODE=supabase npm run dev
curl -i http://localhost:3000/api/auth/smoke
```

Expected:

- HTTP `501`
- `error.code: "auth_not_implemented"`

## 5. PostHog feature flags

Local/env fallback:

```bash
curl -s http://localhost:3000/api/feature-flags | jq
```

Expected:

- HTTP `200`
- `data.source: "env_fallback"` when `POSTHOG_DISABLED=true` or no API key is set
- all six Epic 1 feature flag keys are present

PostHog-backed check:

1. Set `POSTHOG_DISABLED=false`.
2. Set `POSTHOG_API_KEY` to a valid server-side PostHog project key.
3. Create the six feature flags in PostHog:
   - `backend-use-local-processing`
   - `backend-use-gpu-worker`
   - `backend-use-qdrant-sparse`
   - `backend-use-vertex-ai`
   - `backend-use-mastra-workflow`
   - `billing-stripe-enabled`
4. Restart the dev server.
5. Run:

```bash
curl -s http://localhost:3000/api/feature-flags | jq
```

Expected:

- HTTP `200`
- `data.source: "posthog"` when PostHog evaluates successfully
- PostHog values override local env defaults

## 6. Drizzle migration smoke test

With a reachable local Postgres database:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fitfox npm run db:migrate
```

Expected:

- migration applies once
- rerunning does not recreate existing tables
- tables include `profiles`, `wardrobe_items`, `recommendation_runs`, `generated_looks`, `provider_runs`, and Stripe/Qdrant support tables

## 7. Storybook and Chromatic

Run Storybook locally:

```bash
npm run storybook
```

Expected:

- Button, Badge, and FoundationStatus stories render
- variants remain visually distinct in light theme

Run a Chromatic dry run:

```bash
npm run chromatic:dry-run
```

Expected:

- without a token, the command validates the Storybook build locally
- with `CHROMATIC_PROJECT_TOKEN` set, Chromatic CLI performs its remote dry run
