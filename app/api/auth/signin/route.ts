import { ApiError } from "@/lib/api/errors";
import { authFailure, authResponse, authUserPayload, parseAuthPayload } from "@/lib/auth/api";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await parseAuthPayload(request);
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (error) {
      throw new ApiError("auth_required", error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError("auth_required", "Supabase did not return a session.");
    }

    return authResponse(
      request,
      {
        user: authUserPayload(data.user)
      },
      data.session
    );
  } catch (error) {
    return authFailure(request, error);
  }
}
