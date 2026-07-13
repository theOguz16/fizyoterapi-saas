import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMembersController } from "../controllers/admin/members.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { MemberPackageService } from "../services/member-package.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin members controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists members without password hashes", async () => {
    const userRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "member-1",
          email: "member@demo.local",
          first_name: "Ada",
          last_name: "Yilmaz",
          password_hash: "hidden",
        },
      ]),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();
    await AdminMembersController.list(req, res as any);

    expect(res.body).toEqual({
      data: [
        {
          id: "member-1",
          email: "member@demo.local",
          first_name: "Ada",
          last_name: "Yilmaz",
        },
      ],
    });
  });

  it("creates a member with normalized fields and deprecation metadata", async () => {
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      body: {
        email: " MEMBER@DEMO.LOCAL ",
        first_name: " Ada ",
        last_name: " Yilmaz ",
        phone: " 555123 ",
      },
      method: "POST",
      originalUrl: "/api/admin/members",
      headers: { "user-agent": "vitest" },
    } as any;
    const res = createMockResponse();
    await AdminMembersController.create(req, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Admin member başarıyla oluşturuldu",
        data: expect.objectContaining({
          email: "member@demo.local",
          first_name: "Ada",
          last_name: "Yilmaz",
          phone: "555123",
        }),
        deprecation: expect.objectContaining({
          deprecated: true,
        }),
      })
    );
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });

  it("toggles member status and synchronizes salon membership state", async () => {
    const member = {
      id: "member-1",
      tenant_id: "tenant-1",
      email: "member@demo.local",
      first_name: "Ada",
      last_name: "Yilmaz",
      is_active: true,
      deleted_at: null,
    };
    const membership = {
      user_id: "member-1",
      status: "ACTIVE",
      is_active_context: true,
      joined_at: new Date("2026-01-01T09:00:00.000Z"),
      left_at: null,
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(member),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue(membership),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonMembership")) return membershipRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      params: { id: "member-1" },
      body: { is_active: false },
      method: "PATCH",
      originalUrl: "/api/admin/members/member-1/status",
      headers: { "user-agent": "vitest" },
    } as any;
    const res = createMockResponse();
    await AdminMembersController.setStatus(req, res as any);

    expect(member.is_active).toBe(false);
    expect(membership.status).toBe("LEFT");
    expect(membership.is_active_context).toBe(false);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        id: "member-1",
        is_active: false,
      }),
    });
  });

  it("assigns lists adjusts and deactivates member packages", async () => {
    const member = {
      id: "member-1",
      role: "MEMBER",
    };
    const pkg = {
      id: "pkg-1",
      duration_days: 30,
      total_credits: 8,
      display_price: "4200",
      is_active: true,
    };
    const savedUserPackage = {
      id: "up-1",
      tenant_id: "tenant-1",
      user_id: "member-1",
      package_id: "pkg-1",
      remaining_credits: 8,
      starts_at: new Date("2026-05-01T09:00:00.000Z"),
      expires_at: new Date("2026-05-31T09:00:00.000Z"),
      is_active: true,
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(member),
      find: vi.fn().mockResolvedValue([
        { id: "trainer-1", first_name: "Deniz", last_name: "Akin", email: "deniz@demo.local" },
      ]),
    };
    const packageRepo = {
      findOne: vi.fn().mockResolvedValue(pkg),
      find: vi.fn().mockResolvedValue([
        { id: "pkg-1", title: "Starter", type: "LESSON", total_credits: 8, duration_days: 30, display_price: "4200" },
      ]),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Package") && !name.includes("UserPackage")) return packageRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    vi.spyOn(MemberPackageService, "assignPackageToMember").mockResolvedValue({
      userPackage: savedUserPackage as never,
      member: { id: "member-1" } as never,
      package: { id: "pkg-1" } as never,
    });
    vi.spyOn(MemberPackageService, "listMemberPackages").mockResolvedValue({
      data: [
        {
          ...savedUserPackage,
          package_title: "Starter",
          trainer_summary: "Deniz Akin",
          remaining_credits: 8,
        },
      ],
      totalRemainingCredits: 8,
    });
    vi.spyOn(MemberPackageService, "adjustCredits").mockResolvedValue({
      row: {
        ...savedUserPackage,
        remaining_credits: 5,
      } as never,
    });
    vi.spyOn(MemberPackageService, "deactivateUserPackage").mockResolvedValue({
      row: {
        ...savedUserPackage,
        is_active: false,
      } as never,
      member: { id: "member-1" } as never,
    });

    const assignReq = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      params: { id: "member-1" },
      body: { package_id: "pkg-1", starts_at: "2026-05-01T09:00:00.000Z" },
      method: "POST",
      originalUrl: "/api/admin/members/member-1/package",
      headers: { "user-agent": "vitest" },
    } as any;
    const assignRes = createMockResponse();
    await AdminMembersController.assignPackageToMember(assignReq, assignRes as any);
    expect(assignRes.statusCode).toBe(201);

    const listReq = {
      tenantId: "tenant-1",
      params: { id: "member-1" },
    } as any;
    const listRes = createMockResponse();
    await AdminMembersController.listMemberPackages(listReq, listRes as any);
    expect((listRes.body as any).data.items[0]).toEqual(
      expect.objectContaining({
        package_title: "Starter",
        trainer_summary: "Deniz Akin",
        remaining_credits: 8,
      })
    );
    expect((listRes.body as any).data.totalRemainingCredits).toBe(8);

    const adjustReq = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      params: { userPackageId: "up-1" },
      body: { remaining_credits: 5 },
      method: "PATCH",
      originalUrl: "/api/admin/members/user-packages/up-1/credits",
      headers: { "user-agent": "vitest" },
    } as any;
    const adjustRes = createMockResponse();
    await AdminMembersController.adjustCredits(adjustReq, adjustRes as any);
    expect((adjustRes.body as any).data.remaining_credits).toBe(5);

    const removeReq = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      params: { userPackageId: "up-1" },
      method: "DELETE",
      originalUrl: "/api/admin/members/user-packages/up-1",
      headers: { "user-agent": "vitest" },
    } as any;
    const removeRes = createMockResponse();
    await AdminMembersController.removeUserPackage(removeReq, removeRes as any);
    expect(removeRes.body).toEqual({
      message: "User package donduruldu",
      data: expect.objectContaining({
        id: "up-1",
        is_active: false,
      }),
    });
  });
});
