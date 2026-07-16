type LogLevel = "info" | "warn" | "error";

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_LOG_KEY = /(?:^|_)(?:api_key|authorization|cookie|credential|password|secret|token|email|phone|telephone|tel|fax|contact_number|mobile|address|measurement|height|weight|fat|muscle|note|comment|content)(?:_|$)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const MOBILE_PHONE_VALUE = /(?:\+?90[\s().-]*)?(?:0?[\s().-]*)?5\d{2}(?:[\s().-]*\d){7}\b/g;
const INTERNATIONAL_PHONE_VALUE = /\+\d(?:[\s().-]*\d){7,14}/g;
const FORMATTED_PHONE_VALUE = /\b0\d{2,3}(?:[\s().-]+\d{2,4}){2,4}\b/g;
const SECRET_ASSIGNMENT = /\b(?:api[_ -]?key|authorization|password|secret|token)\s*[:=]\s*[^\s,;]+/gi;

function isSensitiveLogKey(key: string) {
  const normalized = key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  if (normalized === "id" || normalized.endsWith("_id") || normalized.endsWith("_ids")) return false;
  return SENSITIVE_LOG_KEY.test(normalized)
    || ["first_name", "full_name", "last_name", "bmi", "blood_pressure", "heart_rate"].includes(normalized);
}

function redactString(value: string) {
  return value
    .replace(EMAIL_VALUE, REDACTED_VALUE)
    .replace(BEARER_VALUE, REDACTED_VALUE)
    .replace(JWT_VALUE, REDACTED_VALUE)
    .replace(MOBILE_PHONE_VALUE, REDACTED_VALUE)
    .replace(INTERNATIONAL_PHONE_VALUE, REDACTED_VALUE)
    .replace(FORMATTED_PHONE_VALUE, REDACTED_VALUE)
    .replace(SECRET_ASSIGNMENT, REDACTED_VALUE);
}

function redactLogValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveLogKey(key)) return REDACTED_VALUE;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactLogValue(childValue, childKey),
      ])
    );
  }
  return value;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: process.env.NODE_ENV === "production" ? "Internal error" : redactString(error.message),
      stack: process.env.NODE_ENV === "production"
        ? undefined
        : typeof error.stack === "string" ? redactString(error.stack) : undefined,
    };
  }

  return {
    message: process.env.NODE_ENV === "production" ? "Internal error" : redactString(String(error)),
  };
}

function write(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const payload = redactLogValue({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...meta,
  });

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export class LoggerService {
  static info(event: string, meta: Record<string, unknown> = {}) {
    write("info", event, meta);
  }

  static warn(event: string, meta: Record<string, unknown> = {}) {
    write("warn", event, meta);
  }

  static error(event: string, error: unknown, meta: Record<string, unknown> = {}) {
    write("error", event, {
      ...meta,
      error: normalizeError(error),
    });
  }
}
