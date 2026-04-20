import { providerRuns } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import type { ProviderName } from "@/lib/api/types";
import type { ProviderRunStatus } from "@/lib/db/schema";
import { redactPayload } from "@/lib/observability/redaction";

export type ProviderRunRecord = {
  userId?: string;
  routeName: string;
  providerName: ProviderName;
  executionMode: "local" | "remote";
  latencyMs: number;
  status: ProviderRunStatus;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorDetails?: Record<string, unknown> | null;
};

export async function recordProviderRun(record: ProviderRunRecord): Promise<void> {
  const db = getDb();

  if (!db) {
    return;
  }

  try {
    await db.insert(providerRuns).values({
      userId: record.userId,
      routeName: record.routeName,
      providerName: record.providerName,
      executionMode: record.executionMode,
      latencyMs: record.latencyMs,
      status: record.status,
      requestPayload: redactPayload(record.requestPayload ?? null) as Record<string, unknown> | null,
      responsePayload: redactPayload(record.responsePayload ?? null) as Record<string, unknown> | null,
      errorDetails: redactPayload(record.errorDetails ?? null) as Record<string, unknown> | null
    });
  } catch (error) {
    console.warn("Provider run logging failed", error);
  }
}

export async function withProviderRun<T>(
  record: Omit<ProviderRunRecord, "latencyMs" | "status" | "responsePayload" | "errorDetails">,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await operation();
    await recordProviderRun({
      ...record,
      latencyMs: Math.round(performance.now() - startedAt),
      status: "success",
      responsePayload: { ok: true }
    });
    return result;
  } catch (error) {
    await recordProviderRun({
      ...record,
      latencyMs: Math.round(performance.now() - startedAt),
      status: "failed",
      errorDetails: {
        message: error instanceof Error ? error.message : "Unknown provider error"
      }
    });
    throw error;
  }
}
