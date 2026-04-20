import { getEnv, getProviderReadiness } from "@/lib/config/env";

export function getReadinessReport() {
  const env = getEnv();
  const providers = getProviderReadiness(env);

  return {
    service: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.APP_ENV,
    providers
  };
}
