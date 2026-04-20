export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "auth_required"
  | "auth_not_implemented"
  | "config_invalid"
  | "provider_unavailable"
  | "internal_error";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: {
    requestId: string;
  };
};

export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ReadinessStatus = "configured" | "disabled" | "failed";

export type ProviderName =
  | "postgres"
  | "gcs"
  | "qdrant"
  | "vertex"
  | "posthog"
  | "stripe"
  | "gpu_backend"
  | "mastra";

export type ProviderRunStatus = "success" | "failed" | "skipped";

export type ProviderReadiness = {
  provider: ProviderName;
  status: ReadinessStatus;
  mode: "local" | "remote";
  message?: string;
};
