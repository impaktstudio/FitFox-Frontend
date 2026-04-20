import { getEnv } from "@/lib/config/env";
import { getPostHogClient } from "@/lib/feature-flags/posthog";
import { redactPayload } from "@/lib/observability/redaction";

export type AnalyticsEventName =
  | "onboarding_item_uploaded"
  | "wardrobe_item_processed"
  | "wardrobe_item_match_indexed"
  | "occasion_session_started"
  | "occasion_session_completed"
  | "look_saved"
  | "look_shared"
  | "look_refined"
  | "purchase_advice_requested"
  | "upgrade_started"
  | "upgrade_completed"
  | "epic1_foundation_event"
  | "feature_flags_evaluated"
  | "auth_smoke_tested";

export async function captureAnalyticsEvent(
  event: AnalyticsEventName,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const env = getEnv();
  const posthog = getPostHogClient(env);

  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId,
      event,
      properties: redactPayload({
        ...properties,
        app_env: env.APP_ENV
      }) as Record<string, unknown>
    });
  } catch (error) {
    console.warn("PostHog analytics capture failed", error);
  }
}
