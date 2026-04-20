import Stripe from "stripe";
import { ApiError } from "@/lib/api/errors";
import type { AppEnv } from "@/lib/config/env";
import { getEnv } from "@/lib/config/env";

let stripeClient: Stripe | null = null;

export function getStripeClient(env: AppEnv = getEnv()): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError("provider_unavailable", "Stripe is not configured.", { provider: "stripe" });
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
