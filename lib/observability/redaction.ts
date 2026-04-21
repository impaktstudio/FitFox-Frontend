const sensitiveKeyPattern = /(api[_-]?key|token|secret|password|authorization|cookie|signature|credential|private[_-]?key|access[_-]?token|refresh[_-]?token)/i;
const maxStringLength = 500;
const maxArrayLength = 25;

export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[redacted:depth]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...[truncated]` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, maxArrayLength).map((item) => redactPayload(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[redacted]" : redactPayload(entry, depth + 1)
      ])
    );
  }

  return "[redacted:unsupported]";
}
