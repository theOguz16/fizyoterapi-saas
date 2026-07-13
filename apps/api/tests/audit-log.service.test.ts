import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../services/audit-log.service";

describe("audit log service", () => {
  it("creates a request id when request headers are absent", () => {
    const req = {} as any;

    const requestId = AuditLogService.ensureRequestId(req);

    expect(typeof requestId).toBe("string");
    expect(requestId.length).toBeGreaterThan(0);
    expect(req.requestId).toBe(requestId);
  });

  it("deduplicates product events by canonical event name and event id", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue({ id: "audit-1" }),
      create: vi.fn(),
      save: vi.fn(),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    const created = await AuditLogService.logProductEvent(
      { event_name: "app_opened", event_id: "event-1", install_id: "install-1" },
      manager
    );

    expect(created).toBe(false);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { event_type: "APP_OPENED", request_id: "event-1" },
      select: ["id"],
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
