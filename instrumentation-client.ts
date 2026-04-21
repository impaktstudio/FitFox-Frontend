import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { resolveSentryRuntimeConfig, shouldDropSentryEvent } from "@/lib/observability/sentry-config";

const sentryConfig = resolveSentryRuntimeConfig("client", {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  NEXT_PUBLIC_SENTRY_ENABLE_LOCAL: process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOCAL,
  NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
});

Sentry.init({
  dsn: sentryConfig.dsn,
  enabled: sentryConfig.enabled,
  environment: sentryConfig.environment,
  sampleRate: sentryConfig.sampleRate,
  tracesSampleRate: sentryConfig.tracesSampleRate,
  replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
  replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
  sendDefaultPii: false,
  maxBreadcrumbs: 50,
  beforeSend(event) {
    return shouldDropSentryEvent(event) ? null : event;
  }
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development"
});
