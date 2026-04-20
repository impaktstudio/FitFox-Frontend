import { ApiError } from "@/lib/api/errors";
import type { AppEnv } from "@/lib/config/env";
import { getEnv } from "@/lib/config/env";

function looksLikeUrl(value: string | undefined): boolean {
  return Boolean(value?.startsWith("http://") || value?.startsWith("https://"));
}

function looksLikeKey(value: string | undefined): boolean {
  return Boolean(value && !looksLikeUrl(value));
}

export function getSupabasePublicConfig(env: AppEnv = getEnv()): { url: string; publishableKey: string } {
  const url = looksLikeUrl(env.NEXT_PUBLIC_SUPABASE_URL) ? env.NEXT_PUBLIC_SUPABASE_URL : env.SUPABASE_URL;
  const publishableKey = looksLikeKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : env.SUPABASE_API_KEY;

  if (!url || !publishableKey) {
    throw new ApiError("config_invalid", "Supabase public URL and publishable key are required.", {
      missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
    });
  }

  return {
    url,
    publishableKey
  };
}
