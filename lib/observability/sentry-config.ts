export type SentryRuntimeScope = "client" | "server";

type SentryEnv = {
  NODE_ENV?: string;
  APP_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
  SENTRY_ENABLED?: string | boolean;
  NEXT_PUBLIC_SENTRY_ENABLED?: string | boolean;
  SENTRY_ENABLE_LOCAL?: string | boolean;
  NEXT_PUBLIC_SENTRY_ENABLE_LOCAL?: string | boolean;
  SENTRY_ERROR_SAMPLE_RATE?: string | number;
  NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE?: string | number;
  SENTRY_TRACES_SAMPLE_RATE?: string | number;
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?: string | number;
  NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string | number;
  NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string | number;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
  SENTRY_AUTH_TOKEN?: string;
  CI?: string;
};

export type SentryRuntimeConfig = {
  dsn: string | undefined;
  enabled: boolean;
  environment: string | undefined;
  sampleRate: number;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  shouldLogLocally: boolean;
};

const localEnvironments = new Set(["local", "test", "development"]);

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

export function parseBooleanFlag(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") return value;

  const normalized = optional(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function parseSampleRate(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function isLocalLike(env: SentryEnv, environment: string | undefined): boolean {
  return env.NODE_ENV === "test" || localEnvironments.has(environment ?? "");
}

export function resolveSentryRuntimeConfig(
  scope: SentryRuntimeScope,
  env: SentryEnv = process.env
): SentryRuntimeConfig {
  const dsn = scope === "client" ? optional(env.NEXT_PUBLIC_SENTRY_DSN) : optional(env.SENTRY_DSN) ?? optional(env.NEXT_PUBLIC_SENTRY_DSN);
  const environment =
    scope === "client"
      ? optional(env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ?? optional(env.NEXT_PUBLIC_APP_ENV)
      : optional(env.SENTRY_ENVIRONMENT) ?? optional(env.APP_ENV);
  const enabledFlag =
    scope === "client" ? parseBooleanFlag(env.NEXT_PUBLIC_SENTRY_ENABLED) : parseBooleanFlag(env.SENTRY_ENABLED);
  const localOptIn =
    scope === "client" ? parseBooleanFlag(env.NEXT_PUBLIC_SENTRY_ENABLE_LOCAL) : parseBooleanFlag(env.SENTRY_ENABLE_LOCAL);
  const localLike = isLocalLike(env, environment);
  const enabled = Boolean(dsn) && (enabledFlag ?? (!localLike || localOptIn === true));
  const sampleRate =
    scope === "client"
      ? parseSampleRate(env.NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE, 1)
      : parseSampleRate(env.SENTRY_ERROR_SAMPLE_RATE, 1);
  const tracesSampleRate =
    scope === "client"
      ? parseSampleRate(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0)
      : parseSampleRate(env.SENTRY_TRACES_SAMPLE_RATE, 0);

  return {
    dsn,
    enabled,
    environment,
    sampleRate,
    tracesSampleRate,
    replaysSessionSampleRate: parseSampleRate(env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
    replaysOnErrorSampleRate: parseSampleRate(env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 0),
    shouldLogLocally: scope === "server" && localLike && env.NODE_ENV !== "test"
  };
}

export function getSentryDsnOrigin(dsn: string | undefined): string | undefined {
  try {
    const parsed = new URL(dsn ?? "");
    return parsed.origin;
  } catch {
    return undefined;
  }
}

export function shouldDropSentryEvent(event: { request?: { url?: string }; exception?: unknown }): boolean {
  const url = event.request?.url;
  if (url?.startsWith("chrome-extension://") || url?.startsWith("moz-extension://")) {
    return true;
  }

  return false;
}

export function shouldUploadSentrySourceMaps(env: SentryEnv = process.env): boolean {
  return Boolean(env.CI && env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);
}
