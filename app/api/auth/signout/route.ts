import { authFailure, signOutResponse } from "@/lib/auth/api";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    await supabase.auth.signOut();

    return signOutResponse(request);
  } catch (error) {
    return authFailure(request, error);
  }
}
