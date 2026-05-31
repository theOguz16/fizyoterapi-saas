type LogLevel = "info" | "warn" | "error";

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return { message: String(error) };
}

function write(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...meta,
  };

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
