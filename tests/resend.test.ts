import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { parseEnv } from "@/lib/config/env";
import { sendTransactionalEmail } from "@/lib/email/resend";

const baseEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  AUTH_MODE: "test",
  TEST_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001"
} as const;

describe("Resend email", () => {
  it("sends transactional email with the configured sender", async () => {
    const send = vi.fn(async () => ({ data: { id: "email_123" }, error: null, headers: null }));
    const result = await sendTransactionalEmail(
      {
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
        idempotencyKey: "welcome/user_123"
      },
      {
        env: parseEnv({
          ...baseEnv,
          RESEND_API_KEY: "re_test",
          RESEND_FROM_EMAIL: "FitFox <hello@example.com>"
        }),
        resend: { send }
      }
    );

    expect(result).toEqual({ id: "email_123" });
    expect(send).toHaveBeenCalledWith(
      {
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
        from: "FitFox <hello@example.com>"
      },
      { idempotencyKey: "welcome/user_123" }
    );
  });

  it("requires Resend configuration before sending", async () => {
    await expect(
      sendTransactionalEmail(
        {
          from: "FitFox <hello@example.com>",
          to: "user@example.com",
          subject: "Welcome",
          text: "Hello"
        },
        {
          env: parseEnv(baseEnv),
          resend: null
        }
      )
    ).rejects.toThrow(ApiError);
  });

  it("surfaces Resend send failures as provider errors", async () => {
    await expect(
      sendTransactionalEmail(
        {
          from: "FitFox <hello@example.com>",
          to: "user@example.com",
          subject: "Welcome",
          text: "Hello"
        },
        {
          env: parseEnv({
            ...baseEnv,
            RESEND_API_KEY: "re_test"
          }),
          resend: {
            send: vi.fn(async () => ({
              data: null,
              error: { name: "validation_error" as const, message: "Invalid sender", statusCode: 400 },
              headers: null
            }))
          }
        }
      )
    ).rejects.toThrow(ApiError);
  });
});
