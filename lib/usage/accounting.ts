import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  capTierFromMetadata,
  estimateUsageCosts,
  evaluateUsagePricing,
  priceCapForTier,
  type UsageCost,
  type UsageUnitInput
} from "@/lib/usage/pricing";

type SupabaseError = {
  code?: string;
  message: string;
};

export type UsageReservation = {
  bucket: string;
  costUsd: number;
  status: "reserved" | "consumed" | "released";
};

export type UsageReservationResult = {
  taskId: string;
  status: "reserved" | "queued" | "succeeded" | "failed";
  duplicate: boolean;
  reservations: UsageReservation[];
  remainingUsdByBucket: Record<string, number>;
};

export type WorkerCompletionResult = {
  taskId: string;
  status: "succeeded" | "failed";
  duplicate: boolean;
};

export type ProfileBillingState = {
  status: string | null;
  currentPeriodEnd: string | null;
  metadata: Record<string, unknown>;
};

export type UsageAccountingStore = {
  getProfileBillingState(userId: string): Promise<ProfileBillingState | null>;
  reserveUsage(input: {
    taskId: string;
    userId: string;
    taskType: string;
    idempotencyKey?: string;
    payload: Record<string, unknown>;
    periodStart: Date;
    periodEnd: Date;
    capUsd: number;
    costs: UsageCost[];
  }): Promise<UsageReservationResult>;
  markTaskQueued(taskId: string, userId: string): Promise<void>;
  getTaskUserId(taskId: string): Promise<string | null>;
  completeTask(input: {
    taskId: string;
    userId: string;
    status: "succeeded" | "failed";
    workerResultId: string;
    failureDetails?: Record<string, unknown>;
  }): Promise<WorkerCompletionResult>;
};

export type UsageReservationContext = UsageReservationResult & {
  capUsd: number;
  capTier: "standard" | "premium";
  costs: UsageCost[];
};

const activeSubscriptionStatuses = new Set(["active", "trialing"]);

const usageReservationSchema = z.object({
  bucket: z.string(),
  costUsd: z.coerce.number(),
  status: z.enum(["reserved", "consumed", "released"])
});

const reservationResultSchema = z.object({
  taskId: z.string(),
  status: z.enum(["reserved", "queued", "succeeded", "failed"]),
  duplicate: z.boolean(),
  reservations: z.array(usageReservationSchema).default([]),
  remainingUsdByBucket: z.record(z.string(), z.coerce.number()).default({})
});

const completionResultSchema = z.object({
  taskId: z.string(),
  status: z.enum(["succeeded", "failed"]),
  duplicate: z.boolean()
});

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function throwSupabaseError(error: SupabaseError | null, operation: string): void {
  if (!error) {
    return;
  }

  if (error.code === "P0001" || error.message.toLowerCase().includes("usage cap exceeded")) {
    throw new ApiError("quota_exceeded", error.message);
  }

  throw new ApiError("provider_unavailable", error.message, {
    provider: "supabase",
    operation
  });
}

function parseReservationResult(value: unknown): UsageReservationResult {
  const parsed = reservationResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("provider_unavailable", "Supabase returned an invalid usage reservation result.", {
      provider: "supabase",
      details: z.treeifyError(parsed.error)
    });
  }

  return parsed.data;
}

function parseCompletionResult(value: unknown): WorkerCompletionResult {
  const parsed = completionResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("provider_unavailable", "Supabase returned an invalid GPU task completion result.", {
      provider: "supabase",
      details: z.treeifyError(parsed.error)
    });
  }

  return parsed.data;
}

export function currentWeeklyUsagePeriod(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(now);
  periodStart.setUTCHours(0, 0, 0, 0);
  periodStart.setUTCDate(periodStart.getUTCDate() - periodStart.getUTCDay());

  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);

  return { periodStart, periodEnd };
}

export function assertSubscriptionAllowsUsage(state: ProfileBillingState | null, now = new Date()): void {
  if (!state?.status || !activeSubscriptionStatuses.has(state.status)) {
    throw new ApiError("auth_required", "An active subscription is required to enqueue GPU tasks.");
  }

  if (!state.currentPeriodEnd || new Date(state.currentPeriodEnd).getTime() <= now.getTime()) {
    throw new ApiError("auth_required", "The current subscription period has ended.");
  }
}

export function createSupabaseUsageAccountingStore(): UsageAccountingStore {
  const supabase = getSupabaseAdminClient();

  return {
    async getProfileBillingState(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("stripe_subscription_status,stripe_current_period_end,stripe_billing_metadata")
        .eq("user_id", userId)
        .maybeSingle();

      throwSupabaseError(error, "selectProfileBillingState");

      if (!data) {
        return null;
      }

      return {
        status: typeof data.stripe_subscription_status === "string" ? data.stripe_subscription_status : null,
        currentPeriodEnd:
          typeof data.stripe_current_period_end === "string" ? data.stripe_current_period_end : null,
        metadata: asRecord(data.stripe_billing_metadata)
      };
    },
    async reserveUsage(input) {
      const { data, error } = await supabase.rpc("reserve_gpu_task_usage", {
        p_task_id: input.taskId,
        p_user_id: input.userId,
        p_task_type: input.taskType,
        p_idempotency_key: input.idempotencyKey ?? null,
        p_payload: input.payload,
        p_period_start: input.periodStart.toISOString(),
        p_period_end: input.periodEnd.toISOString(),
        p_cap_usd: input.capUsd,
        p_costs: input.costs.map((cost) => ({
          bucket: cost.bucket,
          costUsd: cost.costUsd
        }))
      });

      throwSupabaseError(error, "reserveGpuTaskUsage");

      return parseReservationResult(data);
    },
    async markTaskQueued(taskId, userId) {
      const { error } = await supabase.rpc("mark_gpu_task_queued", {
        p_task_id: taskId,
        p_user_id: userId
      });

      throwSupabaseError(error, "markGpuTaskQueued");
    },
    async getTaskUserId(taskId) {
      const { data, error } = await supabase
        .from("gpu_tasks")
        .select("user_id")
        .eq("task_id", taskId)
        .maybeSingle();

      throwSupabaseError(error, "selectGpuTaskUserId");

      return typeof data?.user_id === "string" ? data.user_id : null;
    },
    async completeTask(input) {
      const { data, error } = await supabase.rpc("complete_gpu_task_usage", {
        p_task_id: input.taskId,
        p_user_id: input.userId,
        p_status: input.status,
        p_worker_result_id: input.workerResultId,
        p_failure_details: input.failureDetails ?? null
      });

      throwSupabaseError(error, "completeGpuTaskUsage");

      return parseCompletionResult(data);
    }
  };
}

export async function reserveTaskUsage(input: {
  taskId: string;
  userId: string;
  taskType: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  usageUnits?: UsageUnitInput;
  store?: UsageAccountingStore;
  now?: Date;
}): Promise<UsageReservationContext> {
  const store = input.store ?? createSupabaseUsageAccountingStore();
  const now = input.now ?? new Date();
  const billing = await store.getProfileBillingState(input.userId);

  assertSubscriptionAllowsUsage(billing, now);

  const pricing = await evaluateUsagePricing(input.userId);
  const capTier = capTierFromMetadata(billing?.metadata);
  const capUsd = priceCapForTier(pricing.pricing, capTier);
  const costs = estimateUsageCosts(input.usageUnits, pricing.pricing);
  const period = currentWeeklyUsagePeriod(now);
  const result = await store.reserveUsage({
    taskId: input.taskId,
    userId: input.userId,
    taskType: input.taskType,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    capUsd,
    costs
  });

  return {
    ...result,
    capUsd,
    capTier,
    costs
  };
}

export async function completeTaskUsage(input: {
  taskId: string;
  status: "succeeded" | "failed";
  workerResultId: string;
  failureDetails?: Record<string, unknown>;
  store?: UsageAccountingStore;
}): Promise<WorkerCompletionResult> {
  const env = getEnv();

  if (!env.GPU_WORKER_CALLBACK_SECRET) {
    throw new ApiError("provider_unavailable", "GPU worker callback secret is not configured.", {
      provider: "gpu_backend"
    });
  }

  const store = input.store ?? createSupabaseUsageAccountingStore();
  const userId = await store.getTaskUserId(input.taskId);

  if (!userId) {
    throw new ApiError("bad_request", "GPU task was not found.");
  }

  return store.completeTask({
    taskId: input.taskId,
    userId,
    status: input.status,
    workerResultId: input.workerResultId,
    failureDetails: input.failureDetails
  });
}
