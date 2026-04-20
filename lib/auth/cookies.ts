import type { NextResponse } from "next/server";

export const authCookieNames = {
  accessToken: "fitfox_access_token",
  refreshToken: "fitfox_refresh_token"
} as const;

const maxAgeByCookie = {
  [authCookieNames.accessToken]: 60 * 60,
  [authCookieNames.refreshToken]: 60 * 60 * 24 * 30
} as const;

export function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }

  const cookies = header.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function setAuthCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string },
  secure: boolean
): void {
  response.cookies.set(authCookieNames.accessToken, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeByCookie[authCookieNames.accessToken]
  });
  response.cookies.set(authCookieNames.refreshToken, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeByCookie[authCookieNames.refreshToken]
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(authCookieNames.accessToken, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(authCookieNames.refreshToken, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
