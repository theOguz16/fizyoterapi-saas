import { afterEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../services/logger.service";

describe("logger service", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("redacts sensitive metadata recursively while preserving operational context", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    LoggerService.warn("member_update_failed", {
      request_id: "request-1",
      member_id: "member-1",
      email: "member@example.com",
      accessToken: "raw-access-token",
      apiKey: "raw-api-key",
      api_key: "raw-api-key-2",
      telephone: "+44 20 7946 0958",
      fax: "0212 555 12 12",
      fullName: "Private Member",
      nested: { note: "private note", status: "FAILED" },
      detail: "contact member@example.com, +44 20 7946 0958 or 0212 555 12 12; apiKey=raw-key",
    });

    const payload = JSON.parse(String(output.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: "warn",
      event: "member_update_failed",
      request_id: "request-1",
      member_id: "member-1",
      email: "[REDACTED]",
      accessToken: "[REDACTED]",
      apiKey: "[REDACTED]",
      api_key: "[REDACTED]",
      telephone: "[REDACTED]",
      fax: "[REDACTED]",
      fullName: "[REDACTED]",
      nested: { note: "[REDACTED]", status: "FAILED" },
      detail: "contact [REDACTED], [REDACTED] or [REDACTED]; [REDACTED]",
    });
  });

  it("uses a generic production error message and omits the stack", () => {
    process.env.NODE_ENV = "production";
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    LoggerService.error("request_failed", new Error("member@example.com token leaked"), {
      request_id: "request-2",
    });

    const payload = JSON.parse(String(output.mock.calls[0][0]));
    expect({ ...payload, timestamp: "<timestamp>" }).toMatchInlineSnapshot(`
      {
        "error": {
          "message": "Internal error",
          "name": "Error",
        },
        "event": "request_failed",
        "level": "error",
        "request_id": "request-2",
        "timestamp": "<timestamp>",
      }
    `);
  });

  it("keeps redacted diagnostics and stack traces outside production", () => {
    process.env.NODE_ENV = "test";
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("failed for member@example.com token=raw-token");

    LoggerService.error("request_failed", error, { request_id: "request-3" });

    const payload = JSON.parse(String(output.mock.calls[0][0]));
    expect(payload.error.message).toBe("failed for [REDACTED] [REDACTED]");
    expect(payload.error.stack).toContain("Error: failed for [REDACTED] [REDACTED]");
    expect(payload.error.stack).not.toContain("raw-token");
  });
});
