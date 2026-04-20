import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { AppEnv } from "@/lib/config/env";
import { getEnv } from "@/lib/config/env";

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(env: AppEnv = getEnv()): SupabaseClient {
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_API_KEY;

  if (!env.SUPABASE_URL || !apiKey) {
    throw new ApiError("provider_unavailable", "Supabase admin client is not configured.", {
      provider: "supabase"
    });
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(env.SUPABASE_URL, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseAdminClient;
}
