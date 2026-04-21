import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import {
  getSentryDsnOrigin,
  resolveSentryRuntimeConfig,
  shouldUploadSentrySourceMaps
} from "./lib/observability/sentry-config";

function cspHeader(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const connectSrc = ["'self'", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"];
  const sentryConfig = resolveSentryRuntimeConfig("client");
  const sentryOrigin = sentryConfig.enabled ? getSentryDsnOrigin(sentryConfig.dsn) : undefined;
  if (supabaseUrl.startsWith("https://")) {
    connectSrc.push(supabaseUrl);
  }
  if (sentryOrigin) {
    connectSrc.push(sentryOrigin);
  }

  const directives = [
    "default-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "font-src 'self'",
    "img-src 'self' blob: data:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // required by Next.js / React
    "style-src 'self' 'unsafe-inline'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  return directives.join("; ");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader()
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*"
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*"
      }
    ];
  },
  skipTrailingSlashRedirect: true
};

const uploadSentrySourceMaps = shouldUploadSentrySourceMaps();

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: uploadSentrySourceMaps ? process.env.SENTRY_AUTH_TOKEN : undefined,
  silent: true,
  widenClientFileUpload: uploadSentrySourceMaps,
  sourcemaps: {
    disable: !uploadSentrySourceMaps,
    deleteSourcemapsAfterUpload: true
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  }
});
