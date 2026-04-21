import { afterEach, describe, expect, it, vi } from "vitest";
import { captureRouteException } from "@/lib/observability/sentry";
import { resolveSentryRuntimeConfig, shouldUploadSentrySourceMaps } from "@/lib/observability/sentry-config";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn()
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentry.captureException,
  withScope: (callback: (scope: { setContext: typeof sentry.setContext; setTag: typeof sentry.setTag }) => void) =>
    callback({ setContext: sentry.setContext, setTag: sentry.setTag })
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sentry.captureException.mockClear();
  sentry.setContext.mockClear();
  sentry.setTag.mockClear();
});

describe("Sentry observability", () => {
  it("captures route exceptions with redacted route context", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "https://public@example.com/1");
    const error = new Error("boom");

    captureRouteException(error, {
      requestId: "req_123",
      method: "POST",
      path: "/api/test",
      status: 500,
      code: "internal_error"
    });

    expect(sentry.setTag).toHaveBeenCalledWith("request_id", "req_123");
    expect(sentry.setTag).toHaveBeenCalledWith("api_error_code", "internal_error");
    expect(sentry.setContext).toHaveBeenCalledWith(
      "api_route",
      expect.objectContaining({
        requestId: "req_123",
        method: "POST",
        path: "/api/test",
        status: 500,
        code: "internal_error"
      })
    );
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("logs locally without sending to Sentry by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SENTRY_DSN", "https://public@example.com/1");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    captureRouteException(new Error("boom"), {
      requestId: "req_123",
      method: "POST",
      path: "/api/test",
      status: 500,
      code: "internal_error"
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Route exception",
      expect.objectContaining({ requestId: "req_123", path: "/api/test" }),
      expect.any(Error)
    );
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("Sentry runtime config", () => {
  it("keeps local Sentry disabled by default even when a DSN is present", () => {
    const config = resolveSentryRuntimeConfig("server", {
      NODE_ENV: "development",
      APP_ENV: "local",
      SENTRY_DSN: "https://public@example.com/1"
    });

    expect(config.enabled).toBe(false);
    expect(config.shouldLogLocally).toBe(true);
  });

  it("allows explicit local opt-in", () => {
    const config = resolveSentryRuntimeConfig("server", {
      NODE_ENV: "development",
      APP_ENV: "local",
      SENTRY_DSN: "https://public@example.com/1",
      SENTRY_ENABLE_LOCAL: "true"
    });

    expect(config.enabled).toBe(true);
    expect(config.shouldLogLocally).toBe(true);
  });

  it("enables production Sentry when a DSN is present", () => {
    const config = resolveSentryRuntimeConfig("server", {
      NODE_ENV: "production",
      APP_ENV: "production",
      SENTRY_DSN: "https://public@example.com/1"
    });

    expect(config.enabled).toBe(true);
    expect(config.shouldLogLocally).toBe(false);
  });

  it("lets an explicit disabled flag win", () => {
    const config = resolveSentryRuntimeConfig("server", {
      NODE_ENV: "production",
      APP_ENV: "production",
      SENTRY_DSN: "https://public@example.com/1",
      SENTRY_ENABLED: "false"
    });

    expect(config.enabled).toBe(false);
  });

  it("uses public client sampling knobs and clamps invalid values", () => {
    const config = resolveSentryRuntimeConfig("client", {
      NODE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.com/1",
      NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE: "2",
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "-1"
    });

    expect(config.enabled).toBe(true);
    expect(config.sampleRate).toBe(1);
    expect(config.tracesSampleRate).toBe(0);
  });

  it("uploads source maps only for CI builds with complete Sentry upload config", () => {
    expect(
      shouldUploadSentrySourceMaps({
        CI: "true",
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_ORG: "org",
        SENTRY_PROJECT: "project"
      })
    ).toBe(true);
    expect(shouldUploadSentrySourceMaps({ SENTRY_AUTH_TOKEN: "token", SENTRY_ORG: "org", SENTRY_PROJECT: "project" })).toBe(
      false
    );
  });
});
