import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerMembersController } from "../controllers/trainer/members.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  many?: unknown[];
}) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(result.many ?? []),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
  };
}

describe("trainer members controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists trainer scoped members merged from booking attendance and measurement sources", async () => {
    const bookingRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(createQueryBuilderMock({ many: [{ member_id: "member-1" }] })),
    };
    const attendanceRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(createQueryBuilderMock({ many: [{ member_id: "member-2" }] })),
    };
    const measurementRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(createQueryBuilderMock({ many: [{ member_id: "member-1" }] })),
    };
    const userRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        createQueryBuilderMock({
          many: [
            {
              id: "member-1",
              first_name: "Ada",
              last_name: "Yilmaz",
              email: "ada@demo.local",
              phone: "555",
              is_active: true,
              qr_code: "QR1",
            },
            {
              id: "member-2",
              first_name: "Ece",
              last_name: "Kara",
              email: "ece@demo.local",
              phone: "556",
              is_active: false,
              qr_code: null,
            },
          ],
        })
      ),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1" },
    } as any;
    const res = createMockResponse();
    await TrainerMembersController.list(req, res as any);

    expect(res.body).toEqual({
      data: [
        {
          id: "member-1",
          full_name: "Ada Yilmaz",
          email: "ada@demo.local",
          phone: "555",
          is_active: true,
          qr_code: "QR1",
        },
        {
          id: "member-2",
          full_name: "Ece Kara",
          email: "ece@demo.local",
          phone: "556",
          is_active: false,
          qr_code: null,
        },
      ],
    });
  });

  it("returns trainer member detail with package summary and attendance trend", async () => {
    const member = {
      id: "11111111-1111-4111-8111-111111111111",
      first_name: "Ada",
      last_name: "Yilmaz",
      email: "ada@demo.local",
      phone: "555",
      is_active: true,
      qr_code: "QR1",
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(member),
      find: vi.fn().mockResolvedValue([
        { id: "trainer-2", first_name: "Deniz", last_name: "Akin", email: "deniz@demo.local" },
      ]),
    };
    const bookingRepo = { count: vi.fn().mockResolvedValue(4) };
    const attendanceRepo = {
      count: vi.fn().mockResolvedValue(3),
      createQueryBuilder: vi.fn().mockReturnValue(
        createQueryBuilderMock({
          many: [
            { created_at: "2026-05-02T09:00:00.000Z" },
            { created_at: "2026-05-03T09:00:00.000Z" },
          ],
        })
      ),
    };
    const measurementRepo = {
      findOne: vi.fn().mockResolvedValue({ measured_at: "2026-05-01T09:00:00.000Z" }),
    };
    const userPackageRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "up-1",
          package_id: "pkg-1",
          remaining_credits: 5,
          is_active: true,
          starts_at: "2026-05-01T09:00:00.000Z",
          expires_at: "2026-06-01T09:00:00.000Z",
        },
      ]),
    };
    const referralRewardRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "reward-1", credits_granted: 2, rule_name: "Referral", granted_at: "2026-05-02T09:00:00.000Z" },
      ]),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue({ account_id: "acc-1" }),
    };
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue({ onboarding_profile: { role: "MEMBER" } }),
    };
    const packageRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "pkg-1", title: "Starter", type: "LESSON", total_credits: 8, duration_days: 30, display_price: "4200" },
      ]),
    };
    const assignmentRepo = {
      find: vi.fn().mockResolvedValue([{ package_id: "pkg-1", trainer_id: "trainer-2" }]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("ReferralReward")) return referralRewardRepo as any;
      if (name.includes("SalonMembership")) return membershipRepo as any;
      if (name.includes("Account")) return accountRepo as any;
      if (name.includes("PackageTrainerAssignment")) return assignmentRepo as any;
      if (name.includes("Package") && !name.includes("UserPackage")) return packageRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1" },
      params: { id: member.id },
    } as any;
    const res = createMockResponse();
    await TrainerMembersController.getById(req, res as any);

    expect((res.body as any).data).toEqual(
      expect.objectContaining({
        id: member.id,
        onboarding_profile: { role: "MEMBER" },
        stats: {
          booking_count: 4,
          checkin_count: 3,
          latest_measured_at: "2026-05-01T09:00:00.000Z",
        },
        package_summary: [
          expect.objectContaining({
            package_title: "Starter",
            trainer_summary: "Deniz Akin",
            remaining_credits: 5,
          }),
        ],
        campaign_rewards: [
          {
            id: "reward-1",
            credits_granted: 2,
            rule_name: "Referral",
            granted_at: "2026-05-02T09:00:00.000Z",
          },
        ],
      })
    );
    expect((res.body as any).data.attendance_trend).toHaveLength(1);
  });

  it("creates and deletes structured notes with audit logging", async () => {
    const member = {
      id: "11111111-1111-4111-8111-111111111111",
      role: "MEMBER",
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(member),
    };
    const noteRepo = {
      findOne: vi.fn().mockResolvedValue({ note: "Follow up needed" }),
      save: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const historyRow = {
      id: "note-1",
      note: '__structured_note_v1__:{"title":"Risk notu","body":"Yakın takip","category":"RISK"}',
      created_at: "2026-05-01T09:00:00.000Z",
      updated_at: "2026-05-01T09:00:00.000Z",
    };
    const historyRepo = {
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockImplementation((input) => input),
      save: vi.fn().mockResolvedValue({ id: "note-1" }),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(historyRow)
        .mockResolvedValueOnce(historyRow)
        .mockResolvedValueOnce(historyRow),
      find: vi.fn().mockResolvedValue([historyRow]),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("TrainerMemberNoteHistory")) return historyRepo as any;
      if (name.includes("TrainerMemberNote")) return noteRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const createReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      params: { id: member.id },
      body: {
        title: "Risk notu",
        body: "Yakın takip",
        category: "RISK",
      },
      method: "POST",
      originalUrl: `/api/trainer/members/${member.id}/notes`,
      headers: { "user-agent": "vitest" },
    } as any;
    const createRes = createMockResponse();
    await TrainerMembersController.createNote(createReq, createRes as any);

    expect(createRes.body).toEqual({
      data: {
        member_id: member.id,
        note: "Yakın takip",
        title: "Risk notu",
        body: "Yakın takip",
        category: "RISK",
        updated_at: "2026-05-01T09:00:00.000Z",
      },
    });

    const deleteReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      params: { id: member.id, noteId: "note-1" },
      method: "DELETE",
      originalUrl: `/api/trainer/members/${member.id}/notes/note-1`,
      headers: { "user-agent": "vitest" },
    } as any;
    const deleteRes = createMockResponse();
    await TrainerMembersController.deleteNoteById(deleteReq, deleteRes as any);

    expect(deleteRes.body).toEqual({
      data: {
        id: "note-1",
        deleted: true,
      },
    });
    expect(AuditLogService.log).toHaveBeenCalledTimes(2);
  });
});
