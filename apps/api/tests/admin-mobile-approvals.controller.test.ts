import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMobileApprovalsController } from "../controllers/admin/mobile-approvals.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin mobile approvals controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists queued mobile approvals merged with pending applications in descending time order", async () => {
    const applicationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "app-1",
          account_id: "acc-1",
          status: "PENDING",
          note: JSON.stringify({ note: "Pilates başvurusu" }),
          created_at: "2026-04-23T09:00:00.000Z",
        },
      ]),
      findOne: vi.fn(),
      save: vi.fn(),
    };
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          type: "MEMBER_PAYMENT_REQUEST",
          member_id: "member-1",
          status: "QUEUED",
          created_at: "2026-04-23T10:00:00.000Z",
          payload: {
            account_id: "acc-2",
            amount: 4200,
            package_title: "8 Ders Paket",
            submitted_at: "2026-04-23T10:00:00.000Z",
          },
        },
      ]),
      findOne: vi.fn(),
      save: vi.fn(),
    };
    const accountRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "acc-1", first_name: "Ayse", last_name: "Demir", email: "ayse@example.com" },
        { id: "acc-2", first_name: "Mehmet", last_name: "Kaya", email: "mehmet@example.com" },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonApplication")) return applicationRepo as any;
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      if (name.includes("Account")) return accountRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await AdminMobileApprovalsController.list(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          id: "payment:evt-1",
          type: "PAYMENT",
          member_name: "Mehmet Kaya",
          amount: 4200,
        }),
        expect.objectContaining({
          id: "application:app-1",
          type: "APPLICATION",
          member_name: "Ayse Demir",
          note: "Pilates başvurusu",
        }),
      ],
    });
  });

  it("approves application rows and writes audit records", async () => {
    const application = {
      id: "app-1",
      tenant_id: "tenant-1",
      status: "PENDING",
      payment_status: null,
      note: "",
    };
    const applicationRepo = {
      findOne: vi.fn().mockResolvedValue(application),
      save: vi.fn().mockImplementation(async (row) => row),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonApplication")) return applicationRepo as any;
      return {
        findOne: vi.fn(),
        save: vi.fn(),
      } as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      params: { id: "application:app-1" },
      body: { decision: "APPROVE" },
      method: "PATCH",
      originalUrl: "/api/admin/mobile-approvals/application:app-1",
      headers: { "user-agent": "vitest" },
      requestId: "req-approval-1",
      ip: "127.0.0.1",
    } as any;
    const res = createMockResponse();

    await AdminMobileApprovalsController.decide(req, res as any);

    expect(applicationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "APPROVED",
        payment_status: "UNPAID",
      })
    );
    expect(res.body).toEqual({
      data: { id: "application:app-1", type: "APPLICATION", status: "APPROVED" },
    });
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });
});
