import { describe, expect, it } from "vitest";
import { AuditLogService } from "../services/audit-log.service";

describe("audit log service", () => {
  it("creates a request id when request headers are absent", () => {
    const req = {} as any;

    const requestId = AuditLogService.ensureRequestId(req);

    expect(typeof requestId).toBe("string");
    expect(requestId.length).toBeGreaterThan(0);
    expect(req.requestId).toBe(requestId);
  });
});
