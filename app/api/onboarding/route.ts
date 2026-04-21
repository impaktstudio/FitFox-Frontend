import { routeHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/validation";
import { onboardingPayloadSchema, upsertOnboardingProfile } from "@/lib/auth/onboarding";
import { resolveAuthContext } from "@/lib/auth/server";
import { getEnv } from "@/lib/config/env";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = routeHandler(async (request) => {
  const auth = await resolveAuthContext(request);
  const payload = await parseJsonBody(request, onboardingPayloadSchema);
  const env = getEnv();
  let email: string | undefined;

  if (env.AUTH_MODE === "supabase") {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email;
  }

  await upsertOnboardingProfile({
    userId: auth.userId,
    email,
    ...payload
  });

  return {
    planId: payload.billingPlanId,
    next: payload.billingPlanId === "trial" ? "/" : "/billing?state=pending_checkout"
  };
});
