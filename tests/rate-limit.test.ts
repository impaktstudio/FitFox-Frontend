import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp, authRateLimit, authEmailRateLimit } from "@/lib/api/rate-limit";

describe("rate limiting", () => {
  it("allows requests under the limit", () => {
    const result = checkRateLimit("ip:1", authRateLimit);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 10; i += 1) {
      checkRateLimit("ip:2", authRateLimit);
    }
    const result = checkRateLimit("ip:2", authRateLimit);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets the bucket after the window expires", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    for (let i = 0; i < 10; i += 1) {
      checkRateLimit("ip:3", authRateLimit);
    }
    expect(checkRateLimit("ip:3", authRateLimit).allowed).toBe(false);

    vi.setSystemTime(now + 60_001);
    expect(checkRateLimit("ip:3", authRateLimit).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("getClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns unknown when no proxy is trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "0");
    const request = new Request("https://fitfox.test/api", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8"
      }
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("extracts client IP from x-forwarded-for when proxies are trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "1");
    const request = new Request("https://fitfox.test/api", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8"
      }
    });

    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("extracts the correct IP with multiple trusted proxies", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "2");
    const request = new Request("https://fitfox.test/api", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12"
      }
    });

    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when proxies are trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "1");
    const request = new Request("https://fitfox.test/api", {
      headers: {
        "x-real-ip": "9.9.9.9"
      }
    });

    expect(getClientIp(request)).toBe("9.9.9.9");
  });

  it("ignores x-real-ip when no proxies are trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "0");
    const request = new Request("https://fitfox.test/api", {
      headers: {
        "x-real-ip": "9.9.9.9"
      }
    });

    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("auth email rate limiting", () => {
  it("limits requests per email independently of IP", () => {
    for (let i = 0; i < 5; i += 1) {
      checkRateLimit("auth:signup:email:test@example.com", authEmailRateLimit);
    }
    const result = checkRateLimit("auth:signup:email:test@example.com", authEmailRateLimit);
    expect(result.allowed).toBe(false);

    const otherEmail = checkRateLimit("auth:signup:email:other@example.com", authEmailRateLimit);
    expect(otherEmail.allowed).toBe(true);
  });
});
