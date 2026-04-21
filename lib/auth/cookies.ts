import type { NextResponse } from "next/server";

const legacyAuthCookieNames = {
  accessToken: "fitfox_access_token",
  refreshToken: "fitfox_refresh_token"
} as const;

const secureAuthCookieNames = {
  accessToken: "__Host-fitfox_access_token",
  refreshToken: "__Host-fitfox_refresh_token"
} as const;

export function authCookieNames(secure: boolean) {
  return secure ? secureAuthCookieNames : legacyAuthCookieNames;
}

const maxAgeByCookie: Record<string, number> = {
  [legacyAuthCookieNames.accessToken]: 60 * 60,
  [legacyAuthCookieNames.refreshToken]: 60 * 60 * 24 * 30,
  [secureAuthCookieNames.accessToken]: 60 * 60,
  [secureAuthCookieNames.refreshToken]: 60 * 60 * 24 * 30
};

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
  const names = authCookieNames(secure);

  response.cookies.set(names.accessToken, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeByCookie[names.accessToken]
  });
  response.cookies.set(names.refreshToken, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeByCookie[names.refreshToken]
  });

  if (secure) {
    response.cookies.set(legacyAuthCookieNames.accessToken, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 0
    });
    response.cookies.set(legacyAuthCookieNames.refreshToken, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 0
    });
  }
}

export function clearAuthCookies(response: NextResponse): void {
  for (const names of [legacyAuthCookieNames, secureAuthCookieNames]) {
    response.cookies.set(names.accessToken, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    response.cookies.set(names.refreshToken, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
  }
}
