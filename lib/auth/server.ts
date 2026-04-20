import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { AuthContext } from "@/lib/auth/types";
import { getEnv, isLocalLike } from "@/lib/config/env";

const testHeaderName = "x-fitfox-test-user-id";
const uuid = z.uuid();

export function resolveAuthContext(request: NextRequest | Request): AuthContext {
  const env = getEnv();

  if (env.AUTH_MODE === "supabase") {
    throw new ApiError("auth_not_implemented", "Supabase auth middleware is not implemented yet");
  }

  const headerUserId = request.headers.get(testHeaderName);
  if (headerUserId) {
    if (!isLocalLike(env)) {
      throw new ApiError("auth_required", "Test auth header overrides are only allowed in local/test environments");
    }

    const parsed = uuid.safeParse(headerUserId);
    if (!parsed.success) {
      throw new ApiError("validation_failed", "Test auth header must be a UUID", z.treeifyError(parsed.error));
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
