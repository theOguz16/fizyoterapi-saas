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

  it("reads install, session and funnel context from trusted request headers", () => {
    expect(AuditLogService.productContextFromRequest({ headers: {
      "x-fizyoflow-install-id": "install-1",
      "x-fizyoflow-session-id": "session-1",
      "x-fizyoflow-funnel-id": "funnel-1",
    } })).toEqual({ install_id: "install-1", session_id: "session-1", funnel_id: "funnel-1" });
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
      where: { product_event_name: "app_opened", product_event_id: "event-1" },
      select: ["id"],
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("stores canonical funnel columns and does not allow metadata spoofing", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    await AuditLogService.logProductEvent({
      event_name: "package_created",
      event_id: "event-2",
      install_id: "install-1",
      session_id: "session-1",
      funnel_id: "funnel-1",
      occurred_at: "2026-07-16T10:00:00.000Z",
      metadata: { event_name: "spoofed", funnel_id: "spoofed" },
    }, manager);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      product_event_name: "package_created",
      product_event_id: "event-2",
      product_funnel_id: "funnel-1",
      product_install_id: "install-1",
      product_session_id: "session-1",
      product_occurred_at: new Date("2026-07-16T10:00:00.000Z"),
      metadata: expect.objectContaining({ event_name: "package_created", funnel_id: "funnel-1" }),
    }));
  });

  it("treats a concurrent unique insert as an idempotent duplicate", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockRejectedValue({ code: "23505" }),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    await expect(AuditLogService.logProductEvent({
      event_name: "app_opened",
      event_id: "event-race",
      funnel_id: "funnel-1",
    }, manager)).resolves.toBe(false);
  });
});
