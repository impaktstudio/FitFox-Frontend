import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { authCookieNames, readCookie } from "@/lib/auth/cookies";
import type { AuthContext } from "@/lib/auth/types";
import { getEnv, isLocalLike } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthRequestClient } from "@/lib/supabase/server";

const testHeaderName = "x-fitfox-test-user-id";
const uuid = z.uuid();

function bearerToken(request: NextRequest | Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  const cookieHeader = request.headers.get("cookie");
  for (const secure of [true, false]) {
    const names = authCookieNames(secure);
    const token = readCookie(cookieHeader, names.accessToken);
    if (token) {
      return token;
    }
  }

  return null;
}

async function resolveSupabaseAuthContext(request: NextRequest | Request): Promise<AuthContext> {
  const token = bearerToken(request);

  if (token) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new ApiError("auth_required", "Supabase auth token is invalid or expired.");
    }

    return {
      userId: data.user.id,
      mode: "supabase",
      source: "supabase"
    };
  }

  if (!request.headers.get("cookie")) {
    throw new ApiError("auth_required", "Supabase auth token is required.");
  }

  const supabase = createSupabaseAuthRequestClient(request);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError("auth_required", "Supabase auth token is required.");
  }

  return {
    userId: data.user.id,
    mode: "supabase",
    source: "supabase"
  };
}

export async function resolveAuthContext(request: NextRequest | Request): Promise<AuthContext> {
  const env = getEnv();

  if (env.AUTH_MODE === "supabase") {
    return resolveSupabaseAuthContext(request);
  }

  if (!isLocalLike(env)) {
    throw new ApiError("auth_required", "Test auth mode is only allowed in local/test environments");
  }

  const headerUserId = request.headers.get(testHeaderName);
  if (headerUserId) {
    if (!isLocalLike(env)) {
      throw new ApiError("auth_required", "Test auth header overrides are only allowed in local/test environments");
    }

    const parsed = uuid.safeParse(headerUserId);
    if (!parsed.success) {
      console.warn("Test auth header validation failed", z.treeifyError(parsed.error));
      throw new ApiError("validation_failed", "Test auth header must be a UUID");
    }

    return {
      userId: parsed.data,
      mode: "test",
      source: "test_header"
    };
  }

  if (!env.TEST_AUTH_USER_ID) {
    throw new ApiError("config_invalid", "TEST_AUTH_USER_ID is required when AUTH_MODE=test");
  }

  return {
    userId: env.TEST_AUTH_USER_ID,
    mode: "test",
    source: "test_env"
  };
}
