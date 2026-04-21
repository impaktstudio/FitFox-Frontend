import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockSignInWithOtp, mockVerifyOtp, mockExchangeCodeForSession } = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockExchangeCodeForSession: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRouteHandlerClient: vi.fn(async () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession
    }
  }))
}));

afterEach(() => {
  mockSignInWithOtp.mockReset();
  mockVerifyOtp.mockReset();
  mockExchangeCodeForSession.mockReset();
  vi.unstubAllEnvs();
});

import { POST as requestOtp } from "@/app/api/auth/otp/route";
import { GET as confirmOtp } from "@/app/auth/confirm/route";
import { GET as oauthCallback } from "@/app/auth/callback/route";

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("OTP auth routes", () => {
  it("requests a Supabase magic link with a sanitized redirect", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

    const response = await requestOtp(
      new NextRequest("https://fitfox.test/api/auth/otp", {
        method: "POST",
        body: JSON.stringify({
          email: "Maya@Example.com",
          next: "/wardrobe"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    await expect(json(response)).resolves.toMatchObject({ ok: true, data: { sent: true } });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "maya@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "https://fitfox.test/auth/confirm?next=%2Fwardrobe"
      }
    });
  });

  it("falls back unsafe OTP next paths to onboarding", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

    await requestOtp(
      new NextRequest("https://fitfox.test/api/auth/otp", {
        method: "POST",
        body: JSON.stringify({
          email: "maya@example.com",
          next: "https://evil.test"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://fitfox.test/auth/confirm?next=%2Fonboarding"
        })
      })
    );
  });

  it("verifies token-hash links and redirects to safe next", async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });

    const response = await confirmOtp(
      new NextRequest("https://fitfox.test/auth/confirm?token_hash=abc&type=email&next=/onboarding")
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
    expect(response.headers.get("location")).toBe("https://fitfox.test/onboarding");
  });

  it("rejects invalid confirmation links to the auth error page", async () => {
    const response = await confirmOtp(new NextRequest("https://fitfox.test/auth/confirm"));

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://fitfox.test/auth/error");
  });

  it("exchanges OAuth codes and rejects external next values", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const response = await oauthCallback(
      new NextRequest("https://fitfox.test/auth/callback?code=oauth-code&next=https://evil.test")
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.headers.get("location")).toBe("https://fitfox.test/onboarding");
  });
});
