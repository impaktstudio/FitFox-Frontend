import * as Sentry from "@sentry/nextjs";
import { redactPayload } from "@/lib/observability/redaction";

export type RouteExceptionContext = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  code: string;
};

export function captureRouteException(error: unknown, context: RouteExceptionContext): void {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("request_id", context.requestId);
      scope.setTag("api_error_code", context.code);
      scope.setContext("api_route", redactPayload(context) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } catch (captureError) {
    console.warn("Sentry exception capture failed", captureError);
  }
}
