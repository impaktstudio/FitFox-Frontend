import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/errors";

const signaturePrefix = "v1=";
const maxSignatureAgeMs = 5 * 60 * 1000; // 5 minutes

export function buildGpuWorkerSignature(
  secret: string,
  taskId: string,
  timestamp: number,
  body: string
): string {
  const payload = `${timestamp}.${taskId}.${body}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${timestamp},${signaturePrefix}${mac}`;
}

export function verifyGpuWorkerSignature(
  secret: string,
  taskId: string,
  signatureHeader: string | null,
  body: string
): void {
  if (!signatureHeader) {
    throw new ApiError("auth_required", "Missing GPU worker signature header.");
  }

  const parts = signatureHeader.split(",").reduce(
    (acc, part) => {
      const [key, ...rest] = part.split("=");
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    },
    {} as Record<string, string>
  );

  const timestamp = Number(parts.t);
  const signature = parts.v1;

  if (!Number.isFinite(timestamp) || !signature) {
    throw new ApiError("auth_required", "Invalid GPU worker signature format.");
  }

  const now = Date.now();
  if (now - timestamp > maxSignatureAgeMs || timestamp > now + 60_000) {
    throw new ApiError("auth_required", "GPU worker signature timestamp is invalid or expired.");
  }

  const expected = buildGpuWorkerSignature(secret, taskId, timestamp, body);
  const expectedParts = expected.split(",").reduce(
    (acc, part) => {
      const [key, ...rest] = part.split("=");
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    },
    {} as Record<string, string>
  );

  const expectedSignature = expectedParts.v1;
  if (!expectedSignature) {
    throw new ApiError("auth_required", "GPU worker signature verification failed.");
  }

  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
  const actualBuffer = Buffer.from(signature, "utf-8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new ApiError("auth_required", "GPU worker signature verification failed.");
  }
}
