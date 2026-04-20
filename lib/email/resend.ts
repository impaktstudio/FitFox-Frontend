import { Resend, type CreateEmailOptions } from "resend";
import { ApiError } from "@/lib/api/errors";
import type { AppEnv } from "@/lib/config/env";
import { getEnv } from "@/lib/config/env";

type ResendEmailClient = Pick<Resend["emails"], "send">;

export type SendTransactionalEmailInput = Omit<CreateEmailOptions, "from"> & {
  from?: string;
  idempotencyKey?: string;
};

export type SendTransactionalEmailResult = {
  id: string;
};

let client: ResendEmailClient | null = null;

export function getResendClient(env: AppEnv): ResendEmailClient | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  if (!client) {
    client = new Resend(env.RESEND_API_KEY).emails;
  }

  return client;
}

export function resetResendClient(): void {
  client = null;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
  options: {
    env?: AppEnv;
    resend?: ResendEmailClient | null;
  } = {}
): Promise<SendTransactionalEmailResult> {
  const env = options.env ?? getEnv();
  const resend = options.resend ?? getResendClient(env);

  if (!resend) {
    throw new ApiError("provider_unavailable", "Resend is not configured.", { provider: "resend" });
  }

  const { idempotencyKey, from: inputFrom, ...email } = input;
  const from = inputFrom ?? env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new ApiError("config_invalid", "RESEND_FROM_EMAIL is required to send email.", {
      missing: ["RESEND_FROM_EMAIL"]
    });
  }

  const { data, error } = await resend.send(
    { ...email, from } as CreateEmailOptions,
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw new ApiError("provider_unavailable", error.message, { provider: "resend", name: error.name });
  }

  if (!data) {
    throw new ApiError("provider_unavailable", "Resend did not return an email id.", { provider: "resend" });
  }

  return { id: data.id };
}
