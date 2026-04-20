import type { ApiErrorCode } from "@/lib/api/types";

const defaultStatusByCode: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  auth_required: 401,
  auth_not_implemented: 501,
  config_invalid: 500,
  provider_unavailable: 503,
  internal_error: 500
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? defaultStatusByCode[code];
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError("internal_error", error.message);
  }

  return new ApiError("internal_error", "Unexpected server error");
}
