import type { NextRequest } from "next/server";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { toApiError } from "@/lib/api/errors";
import { captureRouteException } from "@/lib/observability/sentry";

export type RouteContext<TParams = Record<string, string | string[] | undefined>> = {
  params?: TParams | Promise<TParams>;
};

export type HandlerContext<TParams = Record<string, string | string[] | undefined>> = {
  requestId: string;
  params: TParams;
};

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function routeHandler<TData, TParams = Record<string, string | string[] | undefined>>(
  handler: (request: NextRequest, context: HandlerContext<TParams>) => Promise<TData> | TData
) {
  return async (request: NextRequest, context: RouteContext<TParams> = {}) => {
    const requestId = getRequestId(request);

    try {
      const params = context.params ? await context.params : ({} as TParams);
      const data = await handler(request, { requestId, params });
      if (data instanceof Response) {
        return data;
      }
      return apiSuccess(data, requestId);
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.status >= 500) {
        const url = new URL(request.url);
        captureRouteException(error, {
          requestId,
          method: request.method,
          path: url.pathname,
          status: apiError.status,
          code: apiError.code
        });
      }

      return apiFailure(apiError, requestId);
    }
  };
}
