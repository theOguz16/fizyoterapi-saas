import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicController } from "../controllers/public.controller";
import { AppDataSource } from "../data-source";
import { SalonProfile } from "../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { Package, PackageType } from "../entities/package.entity";
import { LessonCategory, SessionStatus, SessionType } from "../entities/class-session.entity";
import { User, UserRole } from "../entities/user.entity";
import { TrainerSkill } from "../entities/trainer-skill.entity";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { createMockResponse } from "./helpers/route-chain";

describe("public day options controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("offers the next clinic working days even when the current week has ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T16:00:00.000Z")); // Cumartesi 19:00, Europe/Istanbul

    const rows = (PublicController as any).buildDayOptions({
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6],
      start_time: "09:00",
      end_time: "11:00",
      slot_minutes: 60,
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
    });

    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows[0]).toMatchObject({
      starts_at: "2026-07-27T06:00:00.000Z",
      weekday: 1,
      weekday_label: "Pazartesi",
    });
    expect(rows[0].label).toContain("27 Tem");
    expect(rows.some((row: any) => row.starts_at === "2026-08-03T06:00:00.000Z")).toBe(true);
  });

  it("returns scheduled group class slots for group package selections", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "demo-salon",
      is_active: true,
      is_public: true,
      review_status: TenantReviewStatus.PUBLISHED,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
      timezone: "Europe/Istanbul",
    } as Tenant;

    const publishedProfile = {
      tenant_id: tenant.id,
      slug: "demo-salon",
      is_published: true,
      business_hours: {
        working_days: [1, 2, 3, 4, 5, 6],
        start_time: "09:00",
        end_time: "18:00",
        slot_minutes: 60,
      },
    } as SalonProfile;

    const groupPackage = {
      id: "9e11693a-0e90-4fc6-8272-b4accb5f8292",
      tenant_id: tenant.id,
      type: PackageType.GROUP,
      capacity: 8,
      rules: {},
    };

    const startsAt = new Date("2026-04-27T07:00:00.000Z");
    const endsAt = new Date("2026-04-27T08:00:00.000Z");

    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        {
          id: "session-1",
          title: "Grup Core Dersi",
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: 8,
          type: SessionType.GROUP,
          status: SessionStatus.SCHEDULED,
          lesson_category: LessonCategory.GRUP,
        },
      ]),
    };
    const packageFind = vi.fn().mockResolvedValue([groupPackage]);

    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (row) => row as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonProfile) {
        return {
          findOne: vi.fn().mockResolvedValue(publishedProfile),
        } as any;
      }
      if (entity === Tenant) {
        return {
          findOne: vi.fn().mockResolvedValue(tenant),
        } as any;
      }
      if (typeof entity === "function" && entity.name === "Package") {
        return {
          find: packageFind,
        } as any;
      }
      if (typeof entity === "function" && entity.name === "ClassSession") {
        return {
          createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        } as any;
      }
      if (typeof entity === "function" && entity.name === "Booking") {
        return {
          createQueryBuilder: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            setParameter: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            getRawMany: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      }
      throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
    });

    const req = {
      params: { slug: "demo-salon" },
      query: { package_ids: "9e11693a-0e90-4fc6-8272-b4accb5f8292" },
    } as any;
    const res = createMockResponse();

    await PublicController.getSalonDayOptions(req, res as any);

    expect(packageFind).toHaveBeenCalledWith({
      where: [
        {
          tenant_id: "tenant-1",
          id: "9e11693a-0e90-4fc6-8272-b4accb5f8292",
          is_active: true,
          is_public: true,
          is_visible: true,
        },
      ],
    });
    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          group_class_id: "session-1",
          group_title: "Grup Core Dersi",
          is_group_class: true,
          lesson_name: "Grup Core Dersi",
          capacity: 8,
        }),
      ],
    });
  });

  it("ignores malformed public package ids before querying UUID columns", async () => {
    const tenant = {
      id: "6b0f5f13-19df-4bca-9bfb-3998f8ce7929",
      slug: "demo-salon",
      is_active: true,
      is_public: true,
      review_status: TenantReviewStatus.PUBLISHED,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
    } as Tenant;
    const profile = { tenant_id: tenant.id, slug: tenant.slug, is_published: true, business_hours: {} } as SalonProfile;
    const trainer = {
      id: "1f790a91-729f-40f9-a055-4fc9a6e905ef",
      tenant_id: tenant.id,
      role: UserRole.TRAINER,
      is_active: true,
      first_name: "Elisa",
      last_name: "Uyar",
    } as User;
    const packageFindOne = vi.fn();

    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (row) => row as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonProfile) return { findOne: vi.fn().mockResolvedValue(profile) } as any;
      if (entity === Tenant) return { findOne: vi.fn().mockResolvedValue(tenant) } as any;
      if (entity === User) return { find: vi.fn().mockResolvedValue([trainer]) } as any;
      if (entity === TrainerSkill) return { find: vi.fn().mockResolvedValue([]) } as any;
      if (entity === Package) return { findOne: packageFindOne } as any;
      throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
    });

    const res = createMockResponse();
    await PublicController.getSalonTrainerOptions(
      { params: { slug: "demo-salon" }, query: { package_id: "e2e-group-8" } } as any,
      res as any
    );

    expect(packageFindOne).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      data: [expect.objectContaining({
        id: trainer.id,
        full_name: "Elisa Uyar",
        compatibility_note: "Salon için uygun eğitmen.",
        matching_slots: 2,
        required_matching_slots: 2,
        is_available: true,
        unavailable_reason: null,
      })],
    });
  });
});
