import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberReferralsController } from "../controllers/member/referrals.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("member referrals controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists member referrals by tenant and member", async () => {
    const referralRepo = {
      find: vi.fn().mockResolvedValue([{ id: "ref-1", status: "INVITED" }]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Referral")) return referralRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1", auth: { sub: "member-1" } } as any;
    const res = createMockResponse();

    await MemberReferralsController.listMine(req, res as any);

    expect(referralRepo.find).toHaveBeenCalledWith({
      where: { tenant_id: "tenant-1", inviter_member_id: "member-1" },
      order: { created_at: "DESC" },
    });
    expect(res.body).toEqual({ data: [{ id: "ref-1", status: "INVITED" }] });
  });

  it("creates a normalized invite and writes audit logs", async () => {
    const memberRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        is_active: true,
      }),
    };
    const referralRepo = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: vi.fn().mockImplementation((payload) => ({ id: "ref-2", status: "INVITED", ...payload })),
      save: vi.fn().mockImplementation(async (payload) => payload),
    };

    vi.spyOn(Math, "random").mockReturnValue(0.123456);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("User")) return memberRepo as any;
      if (name.includes("Referral")) return referralRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", role: "MEMBER" },
      body: { invitee_phone_or_email: "  FRIEND@Example.COM " },
      method: "POST",
      originalUrl: "/api/member/referrals",
      headers: { "user-agent": "vitest" },
      requestId: "req-ref-1",
      ip: "127.0.0.1",
    } as any;
    const res = createMockResponse();

    await MemberReferralsController.createInvite(req, res as any);

    expect(referralRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        inviter_member_id: "member-1",
        invitee_phone_or_email: "friend@example.com",
        status: "INVITED",
      })
    );
    expect(res.statusCode).toBe(201);
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate active invites for the same invitee", async () => {
    const memberRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "member-1", role: "MEMBER", is_active: true }),
    };
    const referralRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "ref-1", status: "INVITED" }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("User")) return memberRepo as any;
      if (name.includes("Referral")) return referralRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: { invitee_phone_or_email: "friend@example.com" },
    } as any;
    const res = createMockResponse();

    await expect(MemberReferralsController.createInvite(req, res as any)).rejects.toMatchObject({
      code: "REFERRAL_ALREADY_EXISTS",
      statusCode: 400,
    });
  });
});
