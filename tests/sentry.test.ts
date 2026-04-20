import { describe, expect, it, vi } from "vitest";
import { captureRouteException } from "@/lib/observability/sentry";

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

describe("Sentry observability", () => {
  it("captures route exceptions with redacted route context", () => {
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
});
