import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { BookingEligibilityService } from "../services/booking-eligibility.service";
import { SlotValidationContractService } from "../services/slot-validation-contract.service";
import { messageForCode } from "../errors/error-catalog";
import { authMiddleware } from "../middlewares/auth.middleware";
import { JobLockService } from "../services/job-lock.service";
import { CampaignEngineService } from "../services/campaign-engine.service";
import { AppDataSource } from "../data-source";
import { CampaignAudience, CampaignFulfillmentType, CampaignRewardTarget, CampaignRewardType, CampaignTriggerType } from "../entities/campaign.entity";

describe("Critical Scenario Set", () => {
  it("maps known error code to Turkish message", () => {
    expect(messageForCode("NO_TOKEN", "fallback")).toContain("Oturum");
  });

  it("returns fallback for unknown error code", () => {
    expect(messageForCode("UNKNOWN_CODE", "fallback")).toBe("fallback");
  });

  it("keeps critical catalog messages user-facing and terminology-safe", () => {
    expect(messageForCode("NO_TENANT_OR_AUTH", "Tenant veya auth bilgisi bulunamadı")).toBe(
      "Klinik veya oturum bilgisine ulaşılamadı. Lütfen tekrar giriş yapın."
    );
    expect(messageForCode("MEMBER_MEASUREMENTS_LIST_ERROR", "fallback")).toBe(
      "Danışan ölçüm geçmişi getirilemedi."
    );
    expect(messageForCode("PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND", "fallback")).toBe(
      "Bu paket için uygun eğitmen ataması bulunamadı."
    );
    expect(messageForCode("INTERNAL_ERROR", "Sunucu hatası")).toBe(
      "Bir sorun oluştu. Lütfen tekrar deneyin."
    );
  });

  it("builds strict intersection for member bookable packages", () => {
    const memberActive = new Map<string, Set<string>>([
      ["m1", new Set(["p1", "p2"])],
      ["m2", new Set(["p3"])],
    ]);
    const result = BookingEligibilityService.buildMemberBookablePackageMap(["m1", "m2"], memberActive, ["p2", "p3"]);
    expect(result.memberBookablePackageIds.m1).toEqual(["p2"]);
    expect(result.memberBookablePackageIds.m2).toEqual(["p3"]);
  });

  it("keeps intersection empty when no eligible package exists", () => {
    const memberActive = new Map<string, Set<string>>([["m1", new Set(["p1"])]]);
    const result = BookingEligibilityService.buildMemberBookablePackageMap(["m1"], memberActive, ["p9"]);
    expect(result.memberBookablePackageIds.m1).toEqual([]);
  });

  it("normalizes legacy sunday working day", () => {
    const normalized = SlotValidationContractService.normalizeWorkingDays([0, 1, 2]);
    expect(normalized).toEqual([1, 2, 7]);
  });

  it("rejects slot alignment mismatch", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      working_days: [1, 2, 3, 4, 5],
      slot_minutes: 30,
      timezone: "Europe/Istanbul",
    });
    const startsAt = new Date("2026-03-04T08:40:00.000Z");
    const endsAt = new Date("2026-03-04T09:10:00.000Z");
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);
    expect(result.ok).toBe(false);
  });

  it("allows Wednesday 11:30 on 30-minute slot", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      slot_minutes: 30,
      timezone: "Europe/Istanbul",
    });
    const startsAt = new Date("2026-03-04T08:30:00.000Z");
    const endsAt = new Date("2026-03-04T09:00:00.000Z");
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);
    expect(result.ok).toBe(true);
  });

  it("rejects lunch break overlap", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      slot_minutes: 30,
      timezone: "Europe/Istanbul",
    });
    const startsAt = new Date("2026-03-04T09:00:00.000Z");
    const endsAt = new Date("2026-03-04T09:30:00.000Z");
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("öğle");
  });

  it("rejects outside business hours", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      working_days: [1, 2, 3, 4, 5],
      slot_minutes: 60,
      timezone: "Europe/Istanbul",
    });
    const startsAt = new Date("2026-03-04T05:00:00.000Z");
    const endsAt = new Date("2026-03-04T06:00:00.000Z");
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);
    expect(result.ok).toBe(false);
  });

  it("supports slot formulas for weekly plans up to 7 lessons", () => {
    const oneLessonRequiredSlots = 1 * 3;
    const oneLessonTrainerFree = Math.ceil(oneLessonRequiredSlots * (2 / 3));
    const fiveLessonRequiredSlots = 5 * 3;
    const fiveLessonTrainerFree = Math.ceil(fiveLessonRequiredSlots * (2 / 3));
    const sevenLessonRequiredSlots = 7 * 3;
    const sevenLessonTrainerFree = Math.ceil(sevenLessonRequiredSlots * (2 / 3));

    expect(oneLessonRequiredSlots).toBe(3);
    expect(oneLessonTrainerFree).toBe(2);
    expect(fiveLessonRequiredSlots).toBe(15);
    expect(fiveLessonTrainerFree).toBe(10);
    expect(sevenLessonRequiredSlots).toBe(21);
    expect(sevenLessonTrainerFree).toBe(14);
  });

  it("checks availability containment for selected slot range", () => {
    const availabilities = [
      { starts_at: "2026-03-04T10:00:00.000Z", ends_at: "2026-03-04T12:00:00.000Z" },
      { starts_at: "2026-03-05T10:00:00.000Z", ends_at: "2026-03-05T11:00:00.000Z" },
    ];
    expect(
      SlotValidationContractService.availabilityContainsRange(
        availabilities,
        new Date("2026-03-04T10:30:00.000Z"),
        new Date("2026-03-04T11:00:00.000Z")
      )
    ).toBe(true);
    expect(
      SlotValidationContractService.availabilityContainsRange(
        availabilities,
        new Date("2026-03-04T12:00:00.000Z"),
        new Date("2026-03-04T12:30:00.000Z")
      )
    ).toBe(false);
  });

  it("returns NO_TRAINER_ASSIGNMENT diagnostic when intersection is empty", () => {
    const memberActive = new Map<string, Set<string>>([["m1", new Set(["p1"])]]);
    const result = BookingEligibilityService.buildMemberBookablePackageMap(["m1"], memberActive, ["p9"]);
    expect(result.memberBookablePackageIds.m1).toEqual([]);
    expect(result.memberPackageDiagnostics.m1.reason_codes).toContain("NO_TRAINER_ASSIGNMENT");
  });

  it("returns NO_SKILL_MATCH diagnostic when assignment exists but skill filter removes all", () => {
    const memberActive = new Map<string, Set<string>>([["m1", new Set(["p1"])]]);
    const result = BookingEligibilityService.buildMemberBookablePackageMap(["m1"], memberActive, ["p1"], {
      packageLessonCategoryMap: { p1: "SKOLYOZ" as any },
      trainerSkillSet: new Set(["PT" as any]),
    });
    expect(result.memberBookablePackageIds.m1).toEqual([]);
    expect(result.memberPackageDiagnostics.m1.reason_codes).toContain("NO_SKILL_MATCH");
  });

  it("accepts cookie token when bearer placeholder is sent", async () => {
    const secret = "test-secret";
    process.env.JWT_SECRET = secret;
    const token = jwt.sign({ sub: "u1", tenantId: "t1", role: "ADMIN" }, secret);

    const req: any = {
      headers: { authorization: "Bearer __cookie_session__" },
      cookies: { accessToken: token },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth?.sub).toBe("u1");
  });

  it("falls back to cookie when bearer token is invalid", async () => {
    const secret = "test-secret-2";
    process.env.JWT_SECRET = secret;
    const token = jwt.sign({ sub: "u2", tenantId: "t2", role: "TRAINER" }, secret);

    const req: any = {
      headers: { authorization: "Bearer invalid-token" },
      cookies: { accessToken: token },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth?.sub).toBe("u2");
  });

  it("returns NO_TOKEN when no header and no cookie exist", () => {
    process.env.JWT_SECRET = "test-secret-3";
    const req: any = { headers: {}, cookies: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "NO_TOKEN" }),
      })
    );
  });

  it("runs job once when advisory lock is acquired", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ ok: true }]);
    const dataSource = {
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        query,
        release: vi.fn().mockResolvedValue(undefined),
      }),
    } as any;

    const task = vi.fn().mockResolvedValue("done");
    const result = await JobLockService.withAdvisoryLock(dataSource, "risk-batch-demo", task);

    expect(result.executed).toBe(true);
    expect(result.result).toBe("done");
    expect(task).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("skips job when advisory lock is not acquired", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ locked: false }]);
    const dataSource = {
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        query,
        release: vi.fn().mockResolvedValue(undefined),
      }),
    } as any;

    const task = vi.fn().mockResolvedValue("done");
    const result = await JobLockService.withAdvisoryLock(dataSource, "risk-batch-demo", task);

    expect(result.executed).toBe(false);
    expect(result.result).toBeNull();
    expect(task).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("applies BOTH referral target to inviter and referred member", async () => {
    const campaign = {
      id: "6b474a08-a765-4c57-aeca-63f90aaa5923", tenant_id: "tenant-1", name: "İki taraflı",
      audience: CampaignAudience.ALL, audience_config: {}, trigger_type: CampaignTriggerType.REFERRAL,
      trigger_count: 2, reward_type: CampaignRewardType.GROUP_CLASS_CREDIT, reward_value: 1,
      reward_target: CampaignRewardTarget.BOTH, fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
      is_active: true,
    } as any;
    vi.spyOn(CampaignEngineService, "list").mockResolvedValue([campaign]);
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({ count: vi.fn().mockResolvedValue(2) } as any);
    const fulfill = vi.spyOn(CampaignEngineService as any, "fulfill").mockResolvedValue(true);

    await expect(CampaignEngineService.processReferral("tenant-1", "inviter-1", "referred-1")).resolves.toBe(2);
    expect(fulfill).toHaveBeenCalledTimes(2);
    expect(fulfill.mock.calls.map((call) => call[1])).toEqual(["inviter-1", "referred-1"]);
  });

  it("does not fulfill a referral campaign before its threshold", async () => {
    const campaign = { trigger_count: 3, reward_target: CampaignRewardTarget.REFERRER } as any;
    vi.spyOn(CampaignEngineService, "list").mockResolvedValue([campaign]);
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({ count: vi.fn().mockResolvedValue(2) } as any);
    const fulfill = vi.spyOn(CampaignEngineService as any, "fulfill").mockResolvedValue(true);

    await expect(CampaignEngineService.processReferral("tenant-1", "inviter-1", "referred-1")).resolves.toBe(0);
    expect(fulfill).not.toHaveBeenCalled();
  });
});
