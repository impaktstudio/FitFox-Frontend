import { PostHog } from "posthog-node";
import type { AppEnv } from "@/lib/config/env";

let client: PostHog | null = null;

export function getPostHogClient(env: AppEnv): PostHog | null {
  if (env.POSTHOG_DISABLED || !env.POSTHOG_API_KEY) {
    return null;
  }

  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST
    });
  }

  return client;
}

export async function shutdownPostHogClient(): Promise<void> {
  if (!client) {
    return;
  }

  await client.shutdown();
  client = null;
}
