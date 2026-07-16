import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../services/audit-log.service";
import { LoggerService } from "../services/logger.service";

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

  it("recursively redacts personal, contact, measurement and note metadata while preserving operational ids", async () => {
    const repo = {
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    await AuditLogService.log({
      event_type: "MEMBER_UPDATED",
      action: "MEMBER_UPDATED",
      path: "/api/members?email=test@example.com",
      request_id: "request-1",
      ip_address: "203.0.113.10",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      error_code: "VALIDATION_ERROR",
      error_message: "test@example.com could not save 72 kg",
      metadata: {
        member_id: "member-1",
        event_name: "member_updated",
        status: "FAILED for member@example.com with Bearer secret-token",
        email: "test@example.com",
        phone: "+90 555 111 22 33",
        note: "private clinical note",
        old_state: {
          measurement_id: "measurement-1",
          weight_kg: 72,
          body_fat_percent: 19,
          fat_percent: 19,
          status: "ACTIVE",
        },
        access_token: "secret-token",
        refreshToken: "refresh-token",
        unclassified_free_text: "must not persist",
      },
    }, manager);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      request_id: "request-1",
      path: "/api/members",
      ip_address: "203.0.113.0",
      user_agent: "ios",
      error_code: "VALIDATION_ERROR",
      error_message: "[REDACTED]",
      metadata: {
        member_id: "member-1",
        event_name: "member_updated",
        status: "FAILED for [REDACTED] with [REDACTED]",
        email: "[REDACTED]",
        phone: "[REDACTED]",
        note: "[REDACTED]",
        old_state: {
          measurement_id: "measurement-1",
          weight_kg: "[REDACTED]",
          body_fat_percent: "[REDACTED]",
          fat_percent: "[REDACTED]",
          status: "ACTIVE",
        },
        access_token: "[REDACTED]",
        refreshToken: "[REDACTED]",
        unclassified_free_text: "[REDACTED]",
      },
    }));
  });

  it("does not exempt demo lead PII from audit metadata redaction", async () => {
    const repo = {
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    await AuditLogService.log({
      event_type: "PRODUCT_SITE_DEMO_LEAD_SUBMIT",
      action: "PRODUCT_SITE_DEMO_LEAD_SUBMIT",
      metadata: {
        demo_lead_id: "11111111-1111-4111-8111-111111111111",
        source: "PRODUCT_SITE_DEMO",
        status: "PERSISTED",
        full_name: "Ayşe Yılmaz",
        email: "ayse@example.com",
        phone: "05551112233",
        note: "özel not",
      },
    }, manager);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        demo_lead_id: "11111111-1111-4111-8111-111111111111",
        source: "PRODUCT_SITE_DEMO",
        status: "PERSISTED",
        full_name: "[REDACTED]",
        email: "[REDACTED]",
        phone: "[REDACTED]",
        note: "[REDACTED]",
      },
    }));
  });

  it("coarsens IPv6 addresses and reduces user agents to a platform category", async () => {
    const repo = {
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;

    await AuditLogService.log({
      event_type: "REQUEST",
      action: "GET /api/member/home",
      ip_address: "2001:db8:abcd:1234:5678:90ab:cdef:1234",
      user_agent: "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A.240905.015)",
    }, manager);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      ip_address: "2001:db8:abcd:1234::",
      user_agent: "android",
    }));
  });

  it("uses the structured logger when an audit write fails", async () => {
    const writeError = new Error("insert failed for member@example.com");
    const repo = {
      create: vi.fn((value) => value),
      save: vi.fn().mockRejectedValue(writeError),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;
    const logger = vi.spyOn(LoggerService, "error").mockImplementation(() => undefined);

    await AuditLogService.log({
      event_type: "MEMBER_UPDATED",
      action: "MEMBER_UPDATED",
      request_id: "request-2",
    }, manager);

    expect(logger).toHaveBeenCalledWith("audit_log_write_failed", writeError, {
      event_type: "MEMBER_UPDATED",
      request_id: "request-2",
    });
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

  it("uses the structured logger and rethrows non-duplicate product event write failures", async () => {
    const writeError = new Error("product event insert failed for member@example.com");
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockRejectedValue(writeError),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(repo) } as any;
    const logger = vi.spyOn(LoggerService, "error").mockImplementation(() => undefined);

    await expect(AuditLogService.logProductEvent({
      event_name: "app_opened",
      event_id: "event-write-failure",
    }, manager)).rejects.toBe(writeError);

    expect(logger).toHaveBeenCalledWith("product_event_write_failed", writeError, {
      event_name: "app_opened",
      event_id: "event-write-failure",
    });
  });
});
