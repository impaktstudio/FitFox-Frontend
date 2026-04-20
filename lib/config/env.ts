import { z } from "zod";
import type { ProviderName, ProviderReadiness } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
      return false;
    }

    throw new Error(`Invalid boolean value: ${value}`);
  });

const optionalUrl = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.url().optional());

const optionalEnvString = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const uuid = z.uuid();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("FitFox"),
  NEXT_PUBLIC_APP_VERSION: z.string().min(1).default("0.1.0"),
  AUTH_MODE: z.enum(["test", "supabase"]).default("test"),
  TEST_AUTH_USER_ID: z
    .string()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(uuid.optional()),
  DATABASE_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_API_KEY: optionalEnvString,
  RAILWAY_USER_WARDROBE_MEDIA_BUCKET_NAME: optionalEnvString,
  RAILWAY_LOOK_MEDIA_BUCKET_NAME: optionalEnvString,
  RAILWAY_REFERENCE_STYLE_LIBRARY_BUCKET_NAME: optionalEnvString,
  RAILWAY_MODEL_PROCESSING_BUCKET_NAME: optionalEnvString,
  RAILWAY_EXPORTS_BUCKET_NAME: optionalEnvString,
  QDRANT_URL: optionalUrl,
  QDRANT_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: optionalEnvString,
  OPENROUTER_BASE_URL: optionalUrl.default("https://openrouter.ai/api/v1"),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: optionalUrl.default("https://us.i.posthog.com"),
  POSTHOG_DISABLED: booleanFromEnv.default(false),
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: optionalEnvString,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: optionalEnvString,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional().default(0),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  INNGEST_EVENT_KEY: optionalEnvString,
  INNGEST_SIGNING_KEY: optionalEnvString,
  INNGEST_DEV: booleanFromEnv.default(false),
  GPU_BACKEND_BASE_URL: optionalUrl,
  GPU_BACKEND_AUTH_TOKEN: z.string().optional(),
  MASTRA_ENABLED: booleanFromEnv.default(false)
});

export type AppEnv = z.infer<typeof envSchema>;

const requiredRailwayBucketKeys = [
  "RAILWAY_USER_WARDROBE_MEDIA_BUCKET_NAME",
  "RAILWAY_LOOK_MEDIA_BUCKET_NAME",
  "RAILWAY_REFERENCE_STYLE_LIBRARY_BUCKET_NAME",
  "RAILWAY_MODEL_PROCESSING_BUCKET_NAME"
] as const satisfies readonly (keyof AppEnv)[];

export function parseEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  try {
    const env = envSchema.parse(source);

    if (env.APP_ENV === "production") {
      const missing: string[] = [];
      if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
      if (!env.SUPABASE_API_KEY) missing.push("SUPABASE_API_KEY");
      if (!env.POSTHOG_DISABLED && !env.POSTHOG_API_KEY) missing.push("POSTHOG_API_KEY");
      if (missing.length > 0) {
        throw new ApiError("config_invalid", "Production configuration is incomplete", { missing });
      }
    }

    return env;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new ApiError("config_invalid", "Environment validation failed", z.treeifyError(error));
    }

    throw error;
  }
}

export function isLocalLike(env: Pick<AppEnv, "APP_ENV" | "NODE_ENV">): boolean {
  return env.APP_ENV === "local" || env.APP_ENV === "test" || env.NODE_ENV === "test";
}

export function getEnv(): AppEnv {
  return parseEnv();
}

type ProviderConfig = {
  provider: ProviderName;
  configured: boolean;
  enabled?: boolean;
  localMessage: string;
  missingMessage: string;
};

export function getProviderReadiness(env: AppEnv): ProviderReadiness[] {
  const missingRequiredRailwayBuckets = requiredRailwayBucketKeys.filter((key) => !env[key]);

  const providers: ProviderConfig[] = [
    {
      provider: "supabase",
      configured: Boolean(env.SUPABASE_URL && env.SUPABASE_API_KEY),
      localMessage: "Supabase is not configured; auth/database-backed routes should use local/test fallbacks.",
      missingMessage: "SUPABASE_URL and SUPABASE_API_KEY are required for Supabase-backed routes."
    },
    {
      provider: "railway",
      configured: missingRequiredRailwayBuckets.length === 0,
      localMessage: "Railway media buckets are not configured.",
      missingMessage: `Required Railway media buckets are missing: ${missingRequiredRailwayBuckets.join(", ")}.`
    },
    {
      provider: "qdrant",
      configured: Boolean(env.QDRANT_URL && env.QDRANT_API_KEY),
      localMessage: "Qdrant Cloud is not configured.",
      missingMessage: "QDRANT_URL and QDRANT_API_KEY are required for remote sparse search."
    },
    {
      provider: "openrouter",
      configured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_BASE_URL),
      localMessage: "OpenRouter is not configured.",
      missingMessage: "OPENROUTER_API_KEY is required for OpenRouter calls."
    },
    {
      provider: "posthog",
      configured: Boolean(!env.POSTHOG_DISABLED && env.POSTHOG_API_KEY),
      enabled: !env.POSTHOG_DISABLED,
      localMessage: "PostHog is disabled or missing a server API key.",
      missingMessage: "POSTHOG_API_KEY is required when PostHog is enabled."
    },
    {
      provider: "sentry",
      configured: Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
      localMessage: "Sentry is not configured.",
      missingMessage: "SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is required for error logging."
    },
    {
      provider: "stripe",
      configured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      localMessage: "Stripe is not configured.",
      missingMessage: "Stripe keys are required for remote billing flows."
    },
    {
      provider: "inngest",
      configured: Boolean(env.INNGEST_EVENT_KEY || env.INNGEST_DEV),
      localMessage: "Inngest is not configured; GPU task dispatch should use local/test fallbacks.",
      missingMessage: "INNGEST_EVENT_KEY is required to enqueue GPU worker tasks."
    },
    {
      provider: "gpu_backend",
      configured: Boolean(env.GPU_BACKEND_BASE_URL && env.GPU_BACKEND_AUTH_TOKEN),
      localMessage: "GPU backend is not configured; app-side interfaces can use local/test fallbacks.",
      missingMessage: "GPU backend URL and token are required when GPU backend flag is enabled."
    },
    {
      provider: "mastra",
      configured: Boolean(env.MASTRA_ENABLED && env.DATABASE_URL),
      enabled: env.MASTRA_ENABLED,
      localMessage: "Mastra is disabled or missing database config.",
      missingMessage: "Mastra requires MASTRA_ENABLED=true and DATABASE_URL."
    }
  ];

  const local = isLocalLike(env);

  return providers.map((provider) => {
    if (provider.configured) {
      return {
        provider: provider.provider,
        status: "configured",
        mode: "remote",
        message: "Configured"
      };
    }

    if (local || provider.enabled === false) {
      return {
        provider: provider.provider,
        status: "disabled",
        mode: "local",
        message: provider.localMessage
      };
    }

    return {
      provider: provider.provider,
      status: "failed",
      mode: "remote",
      message: provider.missingMessage
    };
  });
}
