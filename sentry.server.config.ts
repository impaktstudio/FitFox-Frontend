import * as Sentry from "@sentry/nextjs";
import { resolveSentryRuntimeConfig, shouldDropSentryEvent } from "@/lib/observability/sentry-config";

const sentryConfig = resolveSentryRuntimeConfig("server");

Sentry.init({
  dsn: sentryConfig.dsn,
  enabled: sentryConfig.enabled,
  environment: sentryConfig.environment,
  sampleRate: sentryConfig.sampleRate,
  tracesSampleRate: sentryConfig.tracesSampleRate,
  sendDefaultPii: false,
  maxBreadcrumbs: 50,
  beforeSend(event) {
    return shouldDropSentryEvent(event) ? null : event;
  }
});
