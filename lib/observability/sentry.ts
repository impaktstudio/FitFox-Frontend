import * as Sentry from "@sentry/nextjs";
import { resolveSentryRuntimeConfig } from "@/lib/observability/sentry-config";
import { redactPayload } from "@/lib/observability/redaction";

export type RouteExceptionContext = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  code: string;
};

export function captureRouteException(error: unknown, context: RouteExceptionContext): void {
  const sentryConfig = resolveSentryRuntimeConfig("server");
  const routeContext = redactPayload(context) as Record<string, unknown>;

  if (sentryConfig.shouldLogLocally) {
    console.error("Route exception", routeContext, error);
  }

  if (!sentryConfig.enabled) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      scope.setTag("request_id", context.requestId);
      scope.setTag("api_error_code", context.code);
      scope.setContext("api_route", routeContext);
      Sentry.captureException(error);
    });
  } catch (captureError) {
    console.warn("Sentry exception capture failed", captureError);
  }
}
