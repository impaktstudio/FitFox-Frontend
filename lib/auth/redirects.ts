const defaultPostAuthPath = "/onboarding";

export function safeRelativePath(value: string | null | undefined, fallback = defaultPostAuthPath): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function currentRelativePath(requestUrl: URL): string {
  return `${requestUrl.pathname}${requestUrl.search}`;
}

export function buildAuthRedirectUrl(request: Request, next: string): URL {
  const url = new URL("/auth", request.url);
  url.searchParams.set("next", safeRelativePath(next, "/"));
  return url;
}

export function buildAuthCallbackUrl(request: Request, pathname: "/auth/callback" | "/auth/confirm", next: string): URL {
  const url = new URL(pathname, request.url);
  url.searchParams.set("next", safeRelativePath(next));
  return url;
}
