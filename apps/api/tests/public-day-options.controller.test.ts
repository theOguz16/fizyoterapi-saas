import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicController } from "../controllers/public.controller";
import { AppDataSource } from "../data-source";
import { SalonProfile } from "../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { PackageType } from "../entities/package.entity";
import { LessonCategory, SessionStatus, SessionType } from "../entities/class-session.entity";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { createMockResponse } from "./helpers/route-chain";

describe("public day options controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
      id: "pkg-1",
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
      query: { package_ids: "pkg-1" },
    } as any;
    const res = createMockResponse();

    await PublicController.getSalonDayOptions(req, res as any);

    expect(packageFind).toHaveBeenCalledWith({
      where: [
        {
          tenant_id: "tenant-1",
          id: "pkg-1",
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
});
