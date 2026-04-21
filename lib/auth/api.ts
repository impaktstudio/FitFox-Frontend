import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/handler";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { clearAuthCookies } from "@/lib/auth/cookies";

export function authResponse<T>(request: Request, data: T) {
  return apiSuccess(data, getRequestId(request));
}

export function signOutResponse(request: Request): NextResponse {
  const response = apiSuccess({ signedOut: true }, getRequestId(request));
  clearAuthCookies(response);

  return response;
}

export function authFailure(request: Request, error: unknown): NextResponse {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof Error
        ? new ApiError("internal_error", error.message)
        : new ApiError("internal_error", "Unexpected server error");

  return apiFailure(apiError, getRequestId(request));
}

export function authUserPayload(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}) {
  return {
    id: user.id,
    email: user.email,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {}
  };
}
