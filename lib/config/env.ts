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
  GCS_BUCKET_NAME: z.string().optional(),
  QDRANT_URL: optionalUrl,
  QDRANT_API_KEY: z.string().optional(),
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: optionalUrl.default("https://us.i.posthog.com"),
  POSTHOG_DISABLED: booleanFromEnv.default(false),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GPU_BACKEND_BASE_URL: optionalUrl,
  GPU_BACKEND_AUTH_TOKEN: z.string().optional(),
  MASTRA_ENABLED: booleanFromEnv.default(false),
  FEATURE_BACKEND_USE_LOCAL_PROCESSING: booleanFromEnv.default(true),
  FEATURE_BACKEND_USE_GPU_WORKER: booleanFromEnv.default(false),
  FEATURE_BACKEND_USE_QDRANT_SPARSE: booleanFromEnv.default(false),
  FEATURE_BACKEND_USE_VERTEX_AI: booleanFromEnv.default(false),
  FEATURE_BACKEND_USE_MASTRA_WORKFLOW: booleanFromEnv.default(false),
  FEATURE_BILLING_STRIPE_ENABLED: booleanFromEnv.default(false)
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  try {
    const env = envSchema.parse(source);

    if (env.APP_ENV === "production") {
      const missing: string[] = [];
      if (!env.DATABASE_URL) missing.push("DATABASE_URL");
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
  const providers: ProviderConfig[] = [
    {
      provider: "postgres",
      configured: Boolean(env.DATABASE_URL),
      localMessage: "DATABASE_URL is not set; database-backed routes should use local/test fallbacks.",
      missingMessage: "DATABASE_URL is required for database-backed routes."
    },
    {
      provider: "gcs",
      configured: Boolean(env.GCS_BUCKET_NAME),
      localMessage: "GCS bucket is not configured.",
      missingMessage: "GCS_BUCKET_NAME is required for remote uploads."
    },
    {
      provider: "qdrant",
      configured: Boolean(env.QDRANT_URL && env.QDRANT_API_KEY),
      localMessage: "Qdrant Cloud is not configured.",
      missingMessage: "QDRANT_URL and QDRANT_API_KEY are required for remote sparse search."
    },
    {
      provider: "vertex",
      configured: Boolean(env.VERTEX_PROJECT_ID && env.VERTEX_LOCATION),
      localMessage: "Vertex AI is not configured.",
      missingMessage: "VERTEX_PROJECT_ID and VERTEX_LOCATION are required for Vertex calls."
    },
    {
      provider: "posthog",
      configured: Boolean(!env.POSTHOG_DISABLED && env.POSTHOG_API_KEY),
      enabled: !env.POSTHOG_DISABLED,
      localMessage: "PostHog is disabled or missing a server API key.",
      missingMessage: "POSTHOG_API_KEY is required when PostHog is enabled."
    },
    {
      provider: "stripe",
      configured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      localMessage: "Stripe is not configured.",
      missingMessage: "Stripe keys are required for remote billing flows."
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
