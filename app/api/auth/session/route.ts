import { ApiError } from "@/lib/api/errors";
import { authFailure, authResponse, authUserPayload } from "@/lib/auth/api";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new ApiError("auth_required", "Supabase session is invalid or expired.");
    }

    return authResponse(request, {
      authenticated: true,
      user: authUserPayload(data.user)
    });
  } catch (error) {
    return authFailure(request, error);
  }
}
