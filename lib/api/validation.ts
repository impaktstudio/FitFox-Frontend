import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

function validationError(error: z.ZodError): ApiError {
  return new ApiError("validation_failed", "Request validation failed", z.treeifyError(error));
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: NextRequest | Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError("bad_request", "Request body must be valid JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }

  return parsed.data;
}

export function parseQuery<TSchema extends z.ZodType>(request: NextRequest, schema: TSchema): z.infer<TSchema> {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }

  return parsed.data;
}

export function parseRouteParams<TSchema extends z.ZodType>(
  params: Record<string, string | string[] | undefined>,
  schema: TSchema
): z.infer<TSchema> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }

  return parsed.data;
}
