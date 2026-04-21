import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { currentRelativePath, buildAuthRedirectUrl } from "@/lib/auth/redirects";
import { parseAccountEntitlementFromAppMetadata } from "@/lib/billing/entitlement";
import { createSupabaseRequestClient } from "@/lib/supabase/server";

function isStaticOrBypassedPath(path: string): boolean {
  return (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/ingest/") ||
    path === "/favicon.ico" ||
    path === "/auth/callback" ||
    path === "/auth/confirm" ||
    path === "/auth/error"
  );
}

function isPublicPage(path: string): boolean {
  return path === "/" || path === "/auth" || path === "/auth-throwaway";
}

function isSubscriptionExemptPage(path: string): boolean {
  return path === "/onboarding" || path.startsWith("/onboarding/") || path === "/billing" || path.startsWith("/billing/");
}

function redirectWithRefreshedCookies(url: URL, response: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isStaticOrBypassedPath(path)) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const supabase = createSupabaseRequestClient(request, response);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    if (isPublicPage(path)) {
      return response;
    }

    return redirectWithRefreshedCookies(
      buildAuthRedirectUrl(request, currentRelativePath(request.nextUrl)),
      response
    );
  }

  if (isPublicPage(path)) {
    return response;
  }

  const entitlement = parseAccountEntitlementFromAppMetadata(user.app_metadata ?? {});
  if (!entitlement) {
    if (path === "/onboarding" || path.startsWith("/onboarding/")) {
      return response;
    }

    return redirectWithRefreshedCookies(new URL("/onboarding", request.url), response);
  }

  if (isSubscriptionExemptPage(path)) {
    return response;
  }

  if (entitlement.status === "pending_checkout") {
    return redirectWithRefreshedCookies(new URL("/billing?state=pending_checkout", request.url), response);
  }

  if (entitlement.status === "active" || entitlement.status === "trialing") {
    const now = new Date();
    if (!entitlement.currentPeriodEnd || entitlement.currentPeriodEnd.getTime() <= now.getTime()) {
      return redirectWithRefreshedCookies(new URL("/billing?state=expired", request.url), response);
    }

    return response;
  }

  return redirectWithRefreshedCookies(new URL("/billing?state=inactive", request.url), response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"
  ]
};
