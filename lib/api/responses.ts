import { NextResponse } from "next/server";
import type { ApiFailure, ApiResponse, ApiSuccess } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";

export function apiSuccess<T>(data: T, requestId: string, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta: { requestId }
    },
    { status }
  );
}

export function apiFailure(error: ApiError, requestId: string): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      },
      meta: { requestId }
    },
    { status: error.status }
  );
}

export function responseBody<T>(body: ApiResponse<T>): ApiResponse<T> {
  return body;
}
