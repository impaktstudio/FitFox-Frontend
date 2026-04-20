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

    expect(readiness.find((item) => item.provider === "qdrant")?.status).toBe("disabled");
    expect(readiness.find((item) => item.provider === "stripe")?.status).toBe("disabled");
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
