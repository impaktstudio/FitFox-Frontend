import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { resolveAuthContext } from "@/lib/auth/server";
import { getProviderReadiness, parseEnv } from "@/lib/config/env";

const baseEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001"
} as const;

const railwayBuckets = {
  RAILWAY_USER_WARDROBE_MEDIA_BUCKET_NAME: "fitfox-prod-user-wardrobe-media",
  RAILWAY_LOOK_MEDIA_BUCKET_NAME: "fitfox-prod-look-media",
  RAILWAY_REFERENCE_STYLE_LIBRARY_BUCKET_NAME: "fitfox-prod-reference-style-library",
  RAILWAY_MODEL_PROCESSING_BUCKET_NAME: "fitfox-prod-model-processing",
  RAILWAY_EXPORTS_BUCKET_NAME: "fitfox-prod-exports"
} as const;

const supabaseEnv = {
  SUPABASE_URL: "https://ajoqiyfcjygraohujnnx.supabase.co",
  SUPABASE_API_KEY: "test-supabase-api-key"
} as const;

const openRouterEnv = {
  OPENROUTER_API_KEY: "test-openrouter-api-key"
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env parsing", () => {
  it("rejects invalid enum values", () => {
    expect(() => parseEnv({ ...baseEnv, AUTH_MODE: "anonymous" })).toThrow(ApiError);
  });

  it("allows missing remote secrets in local/test mode", () => {
    const env = parseEnv(baseEnv);
    const readiness = getProviderReadiness(env);

    expect(readiness.find((item) => item.provider === "supabase")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "railway")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "qdrant")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "openrouter")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "inngest")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "sentry")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "stripe")?.status).toBe("disabled");
  });

  it("marks Supabase configured when URL and API key are present", () => {
    const env = parseEnv({
      ...baseEnv,
      ...supabaseEnv
    });

    expect(getProviderReadiness(env).find((item) => item.provider === "supabase")?.status).toBe("configured");
  });

  it("requires Supabase config in production", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: "production",
        APP_ENV: "production"
      })
    ).toThrow(ApiError);
  });

  it("marks OpenRouter configured when an API key is present", () => {
    const env = parseEnv({
      ...baseEnv,
      ...openRouterEnv
    });

    expect(env.OPENROUTER_BASE_URL).toBe("https://openrouter.ai/api/v1");
    expect(getProviderReadiness(env).find((item) => item.provider === "openrouter")?.status).toBe("configured");
  });

  it("marks Inngest configured when an event key is present", () => {
    const env = parseEnv({
      ...baseEnv,
      INNGEST_EVENT_KEY: "test-inngest-event-key"
    });

    expect(getProviderReadiness(env).find((item) => item.provider === "inngest")?.status).toBe("configured");
  });

  it("marks Sentry configured when a DSN is present", () => {
    const env = parseEnv({
      ...baseEnv,
      SENTRY_DSN: "https://public@example.com/1"
    });

    expect(getProviderReadiness(env).find((item) => item.provider === "sentry")?.status).toBe("configured");
  });

  it("treats empty Railway bucket strings as missing", () => {
    const env = parseEnv({
      ...baseEnv,
      RAILWAY_USER_WARDROBE_MEDIA_BUCKET_NAME: "",
      RAILWAY_LOOK_MEDIA_BUCKET_NAME: "",
      RAILWAY_REFERENCE_STYLE_LIBRARY_BUCKET_NAME: "",
      RAILWAY_MODEL_PROCESSING_BUCKET_NAME: "",
      RAILWAY_EXPORTS_BUCKET_NAME: ""
    });

    expect(env.RAILWAY_USER_WARDROBE_MEDIA_BUCKET_NAME).toBeUndefined();
    expect(getProviderReadiness(env).find((item) => item.provider === "railway")?.status).toBe("disabled");
  });

  it("marks Railway configured when required media buckets are present", () => {
    const env = parseEnv({
      ...baseEnv,
      ...railwayBuckets
    });

    expect(getProviderReadiness(env).find((item) => item.provider === "railway")?.status).toBe("configured");
  });

  it("marks Railway failed outside local/test when a required media bucket is missing", () => {
    const env = parseEnv({
      ...baseEnv,
      NODE_ENV: "production",
      APP_ENV: "preview",
      ...railwayBuckets,
      RAILWAY_LOOK_MEDIA_BUCKET_NAME: ""
    });
    const railwayReadiness = getProviderReadiness(env).find((item) => item.provider === "railway");

    expect(railwayReadiness?.status).toBe("failed");
    expect(railwayReadiness?.message).toContain("RAILWAY_LOOK_MEDIA_BUCKET_NAME");
  });

  it("keeps Railway configured when only the optional exports bucket is missing", () => {
    const env = parseEnv({
      ...baseEnv,
      NODE_ENV: "production",
      APP_ENV: "preview",
      ...railwayBuckets,
      RAILWAY_EXPORTS_BUCKET_NAME: ""
    });

    expect(env.RAILWAY_EXPORTS_BUCKET_NAME).toBeUndefined();
    expect(getProviderReadiness(env).find((item) => item.provider === "railway")?.status).toBe("configured");
  });
});

describe("test auth", () => {
  it("resolves TEST_AUTH_USER_ID in test mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("AUTH_MODE", "test");
    vi.stubEnv("TEST_AUTH_USER_ID", baseEnv.TEST_AUTH_USER_ID);

    const request = new NextRequest("https://fitfox.test/api/auth/smoke");

    expect(resolveAuthContext(request)).toEqual({
      userId: baseEnv.TEST_AUTH_USER_ID,
      mode: "test",
      source: "test_env"
    });
  });

  it("requires TEST_AUTH_USER_ID when no allowed header is present", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("AUTH_MODE", "test");
    vi.stubEnv("TEST_AUTH_USER_ID", "");

    const request = new NextRequest("https://fitfox.test/api/auth/smoke");

    expect(() => resolveAuthContext(request)).toThrow(ApiError);
  });

  it("allows test header override only in local/test environments", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("AUTH_MODE", "test");
    vi.stubEnv("TEST_AUTH_USER_ID", baseEnv.TEST_AUTH_USER_ID);

    const request = new NextRequest("https://fitfox.test/api/auth/smoke", {
      headers: {
        "x-fitfox-test-user-id": "00000000-0000-4000-8000-000000000002"
      }
    });

    expect(resolveAuthContext(request).userId).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("returns a typed not-implemented error for Supabase mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("AUTH_MODE", "supabase");

    const request = new NextRequest("https://fitfox.test/api/auth/smoke");

    try {
      resolveAuthContext(request);
      throw new Error("Expected auth resolution to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "auth_not_implemented",
        status: 501
      });
    }
  });
});
