<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the FitMirror Next.js App Router project.

**Client-side** (`posthog-js`) is now initialised via `instrumentation-client.ts` — the recommended approach for Next.js 15.3+. It routes all events through a `/ingest` reverse proxy added to `next.config.ts`, which avoids ad-blocker interference. Session replay and automatic exception capture (`capture_exceptions: true`) are both active.

**Server-side** (`posthog-node`) was already wired up via `lib/feature-flags/posthog.ts` and `lib/observability/analytics.ts`. Three API routes now emit events using the existing `captureAnalyticsEvent` wrapper. Two new event names were added to the `AnalyticsEventName` union type.

Environment variables `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` were added to `.env` for the client-side SDK.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `epic1_foundation_event` | Server-side: fired on every `/api/health` call with service metadata | `app/api/health/route.ts` |
| `feature_flags_evaluated` | Server-side: fired when a user's feature flags are evaluated; includes auth mode and flag source | `app/api/feature-flags/route.ts` |
| `auth_smoke_tested` | Server-side: fired when the auth smoke-test endpoint resolves successfully; includes auth mode and source | `app/api/auth/smoke/route.ts` |
| `health_link_clicked` | Client-side: fired when the user clicks the Health or Ready link on the status page; includes which link was clicked | `components/foundation/foundation-status.tsx` |

## Files created or modified

| File | Change |
|---|---|
| `instrumentation-client.ts` | **Created** — client-side PostHog init with reverse proxy and exception capture |
| `next.config.ts` | **Modified** — added `/ingest` rewrites for PostHog proxy and `skipTrailingSlashRedirect: true` |
| `lib/observability/analytics.ts` | **Modified** — added `feature_flags_evaluated` and `auth_smoke_tested` to `AnalyticsEventName` |
| `app/api/health/route.ts` | **Modified** — captures `epic1_foundation_event` |
| `app/api/feature-flags/route.ts` | **Modified** — captures `feature_flags_evaluated` |
| `app/api/auth/smoke/route.ts` | **Modified** — captures `auth_smoke_tested` |
| `components/foundation/foundation-status.tsx` | **Modified** — added `"use client"`, captures `health_link_clicked` on link clicks |
| `.env` | **Modified** — added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` |

## Next steps

We've built a dashboard and five insights to keep an eye on user behavior and system health, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/279314/dashboard/1487108
- **Health endpoint calls over time**: https://us.posthog.com/project/279314/insights/6dnbynE4
- **Feature flag evaluations over time**: https://us.posthog.com/project/279314/insights/XQhD5vA7
- **Auth smoke test calls over time**: https://us.posthog.com/project/279314/insights/EJA7iF49
- **Health / Ready link clicks (by link)**: https://us.posthog.com/project/279314/insights/cKyon5Dh
- **Feature flag evaluation source breakdown**: https://us.posthog.com/project/279314/insights/TzzLVQuS

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
