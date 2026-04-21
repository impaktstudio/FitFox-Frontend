import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { authCookieNames, readCookie, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

describe("auth cookies", () => {
  it("uses __Host- prefix in secure mode", () => {
    const names = authCookieNames(true);
    expect(names.accessToken).toBe("__Host-fitfox_access_token");
    expect(names.refreshToken).toBe("__Host-fitfox_refresh_token");
  });

  it("uses legacy names in non-secure mode", () => {
    const names = authCookieNames(false);
    expect(names.accessToken).toBe("fitfox_access_token");
    expect(names.refreshToken).toBe("fitfox_refresh_token");
  });

  it("reads a cookie by name", () => {
    const header = "fitfox_access_token=abc123; other=value";
    expect(readCookie(header, "fitfox_access_token")).toBe("abc123");
    expect(readCookie(header, "missing")).toBeNull();
  });

  it("sets secure cookies with __Host- prefix and clears legacy", () => {
    const response = NextResponse.json({});
    setAuthCookies(response, { access_token: "at", refresh_token: "rt" }, true);

    const setCookies = response.cookies.getAll();
    expect(setCookies.some((c) => c.name === "__Host-fitfox_access_token" && c.value === "at")).toBe(true);
    expect(setCookies.some((c) => c.name === "__Host-fitfox_refresh_token" && c.value === "rt")).toBe(true);
    expect(setCookies.some((c) => c.name === "fitfox_access_token" && c.value === "" && c.maxAge === 0)).toBe(true);
    expect(setCookies.some((c) => c.name === "fitfox_refresh_token" && c.value === "" && c.maxAge === 0)).toBe(true);
  });

  it("clears both legacy and secure cookies", () => {
    const response = NextResponse.json({});
    clearAuthCookies(response);

    const setCookies = response.cookies.getAll();
    const cleared = setCookies.filter((c) => c.value === "" && c.maxAge === 0);
    expect(cleared.length).toBe(4);
    expect(cleared.map((c) => c.name).sort()).toEqual([
      "__Host-fitfox_access_token",
      "__Host-fitfox_refresh_token",
      "fitfox_access_token",
      "fitfox_refresh_token"
    ]);
  });
});
