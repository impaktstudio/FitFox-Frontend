import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/config/env";

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (bucket.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: config.maxRequests - bucket.count, resetAt: bucket.resetAt };
}

export const authRateLimit: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 10
};

export const authEmailRateLimit: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 5
};

export const gpuRateLimit: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30
};

export function rateLimitResponse(resetAt: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "quota_exceeded",
        message: "Rate limit exceeded. Please try again later."
      },
      meta: {}
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000))
      }
    }
  );
}

function forwardedClientIp(forwarded: string, trustedCount: number): string | null {
  const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
  if (ips.length === 0) {
    return null;
  }

  if (trustedCount === 0) {
    return null;
  }

  const index = Math.max(0, ips.length - trustedCount - 1);
  return ips[index] ?? null;
}

export function getClientIp(request: NextRequest | Request): string {
  const env = getEnv();
  const trustedCount = env.TRUSTED_PROXY_COUNT ?? 0;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const clientIp = forwardedClientIp(forwarded, trustedCount);
    if (clientIp) {
      return clientIp;
    }
  }

  if (trustedCount > 0) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp;
  }

  return "unknown";
}
