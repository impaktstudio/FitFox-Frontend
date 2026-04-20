import { createServerClient, parseCookieHeader, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}

export function createSupabaseRequestClient(request: NextRequest, response: NextResponse) {
  const config = getSupabasePublicConfig();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });
}

export function createSupabaseAuthRequestClient(request: Request) {
  const config = getSupabasePublicConfig();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "").flatMap((cookie) =>
          cookie.value === undefined ? [] : [{ name: cookie.name, value: cookie.value }]
        );
      },
      setAll() {
        // Route auth validation cannot mutate the response; proxy.ts refreshes cookies before handlers run.
      }
    }
  });
}

export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({
    request
  });
  const supabase = createSupabaseRequestClient(request, response);

  await supabase.auth.getUser();

  return response;
}
