CREATE TYPE "usage_bucket" AS ENUM ('embeddings', 'llm', 'gpu_worker_time');
CREATE TYPE "gpu_task_status" AS ENUM ('reserved', 'queued', 'succeeded', 'failed');
CREATE TYPE "usage_reservation_status" AS ENUM ('reserved', 'consumed', 'released');

CREATE TABLE "gpu_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "task_type" text NOT NULL,
  "idempotency_key" text,
  "status" "gpu_task_status" DEFAULT 'reserved' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "worker_result_id" text,
  "failure_details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "usage_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "bucket" "usage_bucket" NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "cap_usd" numeric(12, 6) NOT NULL,
  "reserved_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
  "consumed_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "usage_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "bucket" "usage_bucket" NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "cost_usd" numeric(12, 6) NOT NULL,
  "status" "usage_reservation_status" DEFAULT 'reserved' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "gpu_tasks_task_id_unique" ON "gpu_tasks" ("task_id");
CREATE UNIQUE INDEX "gpu_tasks_user_id_idempotency_key_unique" ON "gpu_tasks" ("user_id", "idempotency_key");
CREATE UNIQUE INDEX "gpu_tasks_worker_result_id_unique" ON "gpu_tasks" ("worker_result_id");
CREATE INDEX "gpu_tasks_user_id_idx" ON "gpu_tasks" ("user_id");
CREATE INDEX "gpu_tasks_status_idx" ON "gpu_tasks" ("status");
CREATE INDEX "usage_periods_user_id_idx" ON "usage_periods" ("user_id");
CREATE UNIQUE INDEX "usage_periods_user_bucket_period_unique" ON "usage_periods" ("user_id", "bucket", "period_start");
CREATE INDEX "usage_reservations_task_id_idx" ON "usage_reservations" ("task_id");
CREATE INDEX "usage_reservations_user_id_idx" ON "usage_reservations" ("user_id");
CREATE UNIQUE INDEX "usage_reservations_task_bucket_unique" ON "usage_reservations" ("task_id", "bucket");

CREATE OR REPLACE FUNCTION reserve_gpu_task_usage(
  p_task_id text,
  p_user_id uuid,
  p_task_type text,
  p_idempotency_key text,
  p_payload jsonb,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone,
  p_cap_usd numeric,
  p_costs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  task_row gpu_tasks%ROWTYPE;
  cost_item jsonb;
  cost_bucket usage_bucket;
  cost_usd numeric;
  updated_period usage_periods%ROWTYPE;
BEGIN
  SELECT * INTO task_row FROM gpu_tasks WHERE task_id = p_task_id AND user_id = p_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'taskId', p_task_id,
      'status', task_row.status,
      'duplicate', true,
      'reservations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'costUsd', cost_usd, 'status', status))
        FROM usage_reservations
        WHERE task_id = p_task_id AND user_id = p_user_id
      ), '[]'::jsonb),
      'remainingUsdByBucket', COALESCE((
        SELECT jsonb_object_agg(bucket, cap_usd - reserved_usd - consumed_usd)
        FROM usage_periods
        WHERE user_id = p_user_id AND period_start = p_period_start
      ), '{}'::jsonb)
    );
  END IF;

  INSERT INTO gpu_tasks (task_id, user_id, task_type, idempotency_key, status, payload)
  VALUES (p_task_id, p_user_id, p_task_type, p_idempotency_key, 'reserved', p_payload)
  RETURNING * INTO task_row;

  FOR cost_item IN SELECT * FROM jsonb_array_elements(p_costs)
  LOOP
    cost_bucket := (cost_item->>'bucket')::usage_bucket;
    cost_usd := (cost_item->>'costUsd')::numeric;

    INSERT INTO usage_periods (user_id, bucket, period_start, period_end, cap_usd)
    VALUES (p_user_id, cost_bucket, p_period_start, p_period_end, p_cap_usd)
    ON CONFLICT (user_id, bucket, period_start)
    DO UPDATE SET
      period_end = EXCLUDED.period_end,
      cap_usd = EXCLUDED.cap_usd,
      updated_at = now();

    UPDATE usage_periods
    SET reserved_usd = reserved_usd + cost_usd,
      updated_at = now()
    WHERE user_id = p_user_id
      AND bucket = cost_bucket
      AND period_start = p_period_start
      AND reserved_usd + consumed_usd + cost_usd <= cap_usd
    RETURNING * INTO updated_period;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usage cap exceeded for bucket %', cost_bucket USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO usage_reservations (task_id, user_id, bucket, period_start, period_end, cost_usd, status)
    VALUES (p_task_id, p_user_id, cost_bucket, p_period_start, p_period_end, cost_usd, 'reserved');
  END LOOP;

  RETURN jsonb_build_object(
    'taskId', p_task_id,
    'status', 'reserved',
    'duplicate', false,
    'reservations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'costUsd', cost_usd, 'status', status))
      FROM usage_reservations
      WHERE task_id = p_task_id AND user_id = p_user_id
    ), '[]'::jsonb),
    'remainingUsdByBucket', COALESCE((
      SELECT jsonb_object_agg(bucket, cap_usd - reserved_usd - consumed_usd)
      FROM usage_periods
      WHERE user_id = p_user_id AND period_start = p_period_start
    ), '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION mark_gpu_task_queued(
  p_task_id text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE gpu_tasks
  SET status = 'queued',
    updated_at = now()
  WHERE task_id = p_task_id
    AND user_id = p_user_id
    AND status = 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION complete_gpu_task_usage(
  p_task_id text,
  p_user_id uuid,
  p_status text,
  p_worker_result_id text,
  p_failure_details jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  task_row gpu_tasks%ROWTYPE;
  reservation usage_reservations%ROWTYPE;
BEGIN
  IF p_status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'Unsupported GPU task completion status %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO task_row FROM gpu_tasks WHERE task_id = p_task_id AND user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GPU task % was not found', p_task_id USING ERRCODE = 'P0002';
  END IF;

  IF task_row.status IN ('succeeded', 'failed') THEN
    RETURN jsonb_build_object('taskId', p_task_id, 'status', task_row.status, 'duplicate', true);
  END IF;

  FOR reservation IN
    SELECT * FROM usage_reservations
    WHERE task_id = p_task_id AND user_id = p_user_id AND status = 'reserved'
    FOR UPDATE
  LOOP
    IF p_status = 'succeeded' THEN
      UPDATE usage_periods
      SET reserved_usd = GREATEST(0, reserved_usd - reservation.cost_usd),
        consumed_usd = consumed_usd + reservation.cost_usd,
        updated_at = now()
      WHERE user_id = reservation.user_id
        AND bucket = reservation.bucket
        AND period_start = reservation.period_start;

      UPDATE usage_reservations
      SET status = 'consumed',
        updated_at = now()
      WHERE id = reservation.id;
    ELSE
      UPDATE usage_periods
      SET reserved_usd = GREATEST(0, reserved_usd - reservation.cost_usd),
        updated_at = now()
      WHERE user_id = reservation.user_id
        AND bucket = reservation.bucket
        AND period_start = reservation.period_start;

      UPDATE usage_reservations
      SET status = 'released',
        updated_at = now()
      WHERE id = reservation.id;
    END IF;
  END LOOP;

  UPDATE gpu_tasks
  SET status = p_status::gpu_task_status,
    worker_result_id = COALESCE(p_worker_result_id, worker_result_id),
    failure_details = CASE WHEN p_status = 'failed' THEN p_failure_details ELSE failure_details END,
    updated_at = now()
  WHERE task_id = p_task_id AND user_id = p_user_id
  RETURNING * INTO task_row;

  RETURN jsonb_build_object('taskId', p_task_id, 'status', task_row.status, 'duplicate', false);
END;
$$;
