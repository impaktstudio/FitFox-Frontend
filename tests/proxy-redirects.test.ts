import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_API_KEY", "test-api-key");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "test");
});

const { mockGetUser, createSupabaseRequestClient } = vi.hoisted(() => {
  const getUser = vi.fn();

  return {
    mockGetUser: getUser,
    createSupabaseRequestClient: vi.fn((_request: NextRequest, _response: NextResponse) => ({
      auth: {
        getUser
      }
    }))
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRequestClient
}));

afterEach(() => {
  mockGetUser.mockReset();
  createSupabaseRequestClient.mockClear();
  vi.useRealTimers();
});

import { proxy } from "@/proxy";

describe("proxy auth and entitlement redirects", () => {
  it("bypasses API routes before creating a Supabase client", async () => {
    const request = new NextRequest(new URL("https://fitfox.test/api/health"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(createSupabaseRequestClient).not.toHaveBeenCalled();
  });

  it("bypasses auth callbacks before creating a Supabase client", async () => {
    const request = new NextRequest(new URL("https://fitfox.test/auth/confirm?token_hash=abc&type=email"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(createSupabaseRequestClient).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated protected pages to auth with a relative next path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const request = new NextRequest(new URL("https://fitfox.test/wardrobe?view=list"));
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fitfox.test/auth?next=%2Fwardrobe%3Fview%3Dlist");
  });

  it("keeps public auth pages available without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const request = new NextRequest(new URL("https://fitfox.test/auth"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it("redirects authenticated users missing onboarding metadata to onboarding", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {}
        }
      },
      error: null
    });

    const request = new NextRequest(new URL("https://fitfox.test/wardrobe"));
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fitfox.test/onboarding");
  });

  it("allows onboarding without billing metadata when authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {}
        }
      },
      error: null
    });

    const request = new NextRequest(new URL("https://fitfox.test/onboarding"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it("redirects pending checkout users to billing", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {
            emailConfirmed: true,
            stripe: {
              supabaseAuthUserId: "00000000-0000-4000-8000-000000000001",
              subscriptionStatus: "pending_checkout",
              selectedBillingPlanId: "monthly"
            }
          }
        }
      },
      error: null
    });

    const request = new NextRequest(new URL("https://fitfox.test/recommendations"));
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fitfox.test/billing?state=pending_checkout");
  });

  it("redirects expired subscriptions to billing", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {
            emailConfirmed: true,
            stripe: {
              supabaseAuthUserId: "00000000-0000-4000-8000-000000000001",
              subscriptionStatus: "active",
              currentPeriodEnd: "2026-04-01T00:00:00.000Z",
              selectedBillingPlanId: "monthly"
            }
          }
        }
      },
      error: null
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));

    const request = new NextRequest(new URL("https://fitfox.test/dashboard"));
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fitfox.test/billing?state=expired");
  });

  it("preserves refreshed cookies on redirects", async () => {
    createSupabaseRequestClient.mockImplementationOnce((_request: NextRequest, response: NextResponse) => {
      response.cookies.set("sb-test", "fresh", { path: "/" });
      return {
        auth: {
          getUser: mockGetUser
        }
      };
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {
            emailConfirmed: true,
            stripe: {
              supabaseAuthUserId: "00000000-0000-4000-8000-000000000001",
              subscriptionStatus: "pending_checkout",
              selectedBillingPlanId: "monthly"
            }
          }
        }
      },
      error: null
    });

    const request = new NextRequest(new URL("https://fitfox.test/recommendations"));
    const response = await proxy(request);

    expect(response.cookies.get("sb-test")?.value).toBe("fresh");
  });

  it("passes through active non-expired users", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          app_metadata: {
            emailConfirmed: true,
            stripe: {
              supabaseAuthUserId: "00000000-0000-4000-8000-000000000001",
              subscriptionStatus: "active",
              currentPeriodEnd: "2026-12-01T00:00:00.000Z",
              selectedBillingPlanId: "monthly"
            }
          }
        }
      },
      error: null
    });

    const request = new NextRequest(new URL("https://fitfox.test/dashboard"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });
});
