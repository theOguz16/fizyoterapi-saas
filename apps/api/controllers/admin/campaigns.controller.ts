import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { Tenant } from "../../entities/tenant.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

type CampaignAudience = "ALL" | "RISK" | "NEW";
type CampaignTriggerType = "REFERRAL" | "ATTENDANCE";
type CampaignRewardType = "DISCOUNT" | "FREE_CLASS" | "GROUP_CLASS_CREDIT";
type CampaignRewardTarget = "REFERRER" | "REFERRED" | "BOTH" | "MEMBER";

type ReferralCampaignRule = {
  id: string;
  name?: string;
  audience?: CampaignAudience;
  trigger_type?: CampaignTriggerType;
  required_referrals: number;
  reward_type: CampaignRewardType;
  reward_value: number;
  reward_label: string;
  reward_target?: CampaignRewardTarget;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type LoyaltyCampaignRule = {
  id: string;
  name?: string;
  audience?: CampaignAudience;
  trigger_type?: CampaignTriggerType;
  min_lessons: number;
  reward_type: CampaignRewardType;
  reward_value: number;
  reward_label: string;
  reward_target?: CampaignRewardTarget;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type CampaignAuditEntry = {
  id: string;
  action: string;
  summary: string;
  actor_id?: string | null;
  created_at: string;
};

export class AdminCampaignsController {
  private static getCampaignCollections(campaigns: ReturnType<typeof AdminCampaignsController.normalizeCampaigns>) {
    return [
      { type: "REFERRAL" as const, items: campaigns.referral_campaigns },
      { type: "ATTENDANCE" as const, items: campaigns.loyalty_campaigns },
    ];
  }

  private static findCampaignById(
    campaigns: ReturnType<typeof AdminCampaignsController.normalizeCampaigns>,
    campaignId: string
  ) {
    for (const collection of AdminCampaignsController.getCampaignCollections(campaigns)) {
      const index = collection.items.findIndex((row) => row.id === campaignId);
      if (index >= 0) {
        return {
          collectionType: collection.type,
          index,
          item: collection.items[index],
        };
      }
    }
    return null;
  }

  private static async ensureProfile(tenantId: string) {
    const profileRepo = AppDataSource.getRepository(SalonProfile);
    let profile = await profileRepo.findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
    });
    if (profile) return profile;

    const tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
    });

    profile = profileRepo.create({
      tenant_id: tenantId,
      slug: tenant?.slug || `tenant-${tenantId.slice(0, 8)}`,
      hero_title: "",
      hero_subtitle: "",
      hero_image_url: "",
      about_text: "",
      why_us: [],
      services: [],
      location: {},
      social_links: {},
      theme: "minimal",
      primary_color: "#111827",
      business_hours: {
        timezone: "Europe/Istanbul",
        working_days: [1, 2, 3, 4, 5, 6, 7],
        start_time: "09:00",
        end_time: "18:00",
        lunch_break_start: "12:00",
        lunch_break_end: "13:00",
        slot_minutes: 60,
      },
      is_published: false,
    });
    await profileRepo.save(profile);
    return profile;
  }

  private static normalizeCampaignAudit(value: unknown): CampaignAuditEntry[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const createdAtRaw = String(row.created_at ?? "").trim();
        const createdAt = createdAtRaw && !Number.isNaN(new Date(createdAtRaw).getTime())
          ? new Date(createdAtRaw).toISOString()
          : new Date().toISOString();

        return {
          id: String(row.id ?? "").trim() || `audit-${index + 1}`,
          action: String(row.action ?? "CAMPAIGN_RULES_UPDATED"),
          summary: String(row.summary ?? "Kampanya kuralları güncellendi"),
          actor_id: row.actor_id ? String(row.actor_id) : null,
          created_at: createdAt,
        };
      })
      .slice(-120);
  }

  private static normalizeCampaigns(value: unknown) {
    const defaults = {
      referral_campaigns: [
        {
          id: "ref-default-2",
          name: "Varsayılan referans kampanyası",
          audience: "ALL" as CampaignAudience,
          trigger_type: "REFERRAL" as CampaignTriggerType,
          required_referrals: 2,
          reward_type: "FREE_CLASS" as CampaignRewardType,
          reward_value: 1,
          reward_label: "2 kişi getirene 1 ücretsiz grup dersi",
          reward_target: "REFERRER" as CampaignRewardTarget,
          is_active: true,
        },
      ] as ReferralCampaignRule[],
      loyalty_campaigns: [] as LoyaltyCampaignRule[],
      cancellation_policy: {
        min_hours_before_start: 3,
        refund_policy: "NO_REFUND",
      },
    };

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return defaults;
    }

    const source = value as Record<string, unknown>;
    const referralCampaigns = Array.isArray(source.referral_campaigns) ? source.referral_campaigns : defaults.referral_campaigns;
    const loyaltyCampaigns = Array.isArray(source.loyalty_campaigns) ? source.loyalty_campaigns : defaults.loyalty_campaigns;
    const cancellationPolicyRaw =
      source.cancellation_policy && typeof source.cancellation_policy === "object" && !Array.isArray(source.cancellation_policy)
        ? (source.cancellation_policy as Record<string, unknown>)
        : defaults.cancellation_policy;

    return {
      referral_campaigns: referralCampaigns
        .map((entry, index) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(row.id ?? "").trim() || `ref-${index + 1}`,
            name: String(row.name ?? "").trim() || undefined,
            audience: AdminCampaignsController.normalizeAudience(row.audience),
            trigger_type: "REFERRAL" as CampaignTriggerType,
            required_referrals: Math.max(1, Math.floor(Number(row.required_referrals) || 0)),
            reward_type: AdminCampaignsController.normalizeRewardType(row.reward_type),
            reward_value: Math.max(0, Number(row.reward_value) || 0),
            reward_label: String(row.reward_label ?? "").trim() || "Ödül",
            reward_target: AdminCampaignsController.normalizeRewardTarget(row.reward_target, "REFERRER"),
            is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            created_at: AdminCampaignsController.normalizeDate(row.created_at),
            updated_at: AdminCampaignsController.normalizeDate(row.updated_at),
          };
        })
        .filter((row) => row.required_referrals > 0),
      loyalty_campaigns: loyaltyCampaigns
        .map((entry, index) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(row.id ?? "").trim() || `loy-${index + 1}`,
            name: String(row.name ?? "").trim() || undefined,
            audience: AdminCampaignsController.normalizeAudience(row.audience),
            trigger_type: "ATTENDANCE" as CampaignTriggerType,
            min_lessons: Math.max(1, Math.floor(Number(row.min_lessons) || 0)),
            reward_type: AdminCampaignsController.normalizeRewardType(row.reward_type),
            reward_value: Math.max(0, Number(row.reward_value) || 0),
            reward_label: String(row.reward_label ?? "").trim() || "Ödül",
            reward_target: AdminCampaignsController.normalizeRewardTarget(row.reward_target, "MEMBER"),
            is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            created_at: AdminCampaignsController.normalizeDate(row.created_at),
            updated_at: AdminCampaignsController.normalizeDate(row.updated_at),
          };
        })
        .filter((row) => row.min_lessons > 0),
      cancellation_policy: {
        min_hours_before_start: Math.max(1, Math.floor(Number(cancellationPolicyRaw.min_hours_before_start) || 3)),
        refund_policy: String(cancellationPolicyRaw.refund_policy ?? "NO_REFUND"),
      },
    };
  }

  private static normalizeDate(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) return undefined;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private static normalizeAudience(value: unknown): CampaignAudience {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "RISK" || raw === "NEW") return raw;
    return "ALL";
  }

  private static normalizeRewardType(value: unknown): CampaignRewardType {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "DISCOUNT" || raw === "FREE_CLASS" || raw === "GROUP_CLASS_CREDIT") return raw;
    return "FREE_CLASS";
  }

  private static normalizeRewardTarget(value: unknown, fallback: CampaignRewardTarget): CampaignRewardTarget {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "REFERRER" || raw === "REFERRED" || raw === "BOTH" || raw === "MEMBER") return raw;
    return fallback;
  }

  private static buildRewardLabel(input: {
    triggerType: CampaignTriggerType;
    triggerCount: number;
    rewardType: CampaignRewardType;
    rewardValue: number;
    rewardTarget: CampaignRewardTarget;
  }) {
    const condition =
      input.triggerType === "REFERRAL"
        ? `${input.triggerCount} referans sonrası`
        : `${input.triggerCount} ders sonrası`;

    const reward =
      input.rewardType === "DISCOUNT"
        ? `%${input.rewardValue} indirim`
        : `${input.rewardValue} ücretsiz grup dersi`;

    const target =
      input.triggerType === "REFERRAL"
        ? {
            REFERRER: " referans olana",
            REFERRED: " yeni üyeye",
            BOTH: " her iki üyeye",
            MEMBER: "",
          }[input.rewardTarget]
        : "";

    return `${condition}${target} ${reward}`.trim();
  }

  private static buildSummary(campaigns: ReturnType<typeof AdminCampaignsController.normalizeCampaigns>) {
    const referral = campaigns.referral_campaigns.length;
    const loyalty = campaigns.loyalty_campaigns.length;
    const active =
      campaigns.referral_campaigns.filter((row) => row.is_active).length +
      campaigns.loyalty_campaigns.filter((row) => row.is_active).length;

    return {
      total: referral + loyalty,
      active,
      referral,
      loyalty,
    };
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const profile = await AdminCampaignsController.ensureProfile(tenantId);
      const location =
        profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? (profile.location as Record<string, unknown>)
          : {};
      const campaigns = AdminCampaignsController.normalizeCampaigns(location.campaigns);
      const audit = AdminCampaignsController.normalizeCampaignAudit(location.campaign_audit);

      return res.json({
        data: {
          campaigns,
          audit,
          items: [...campaigns.referral_campaigns, ...campaigns.loyalty_campaigns],
          summary: AdminCampaignsController.buildSummary(campaigns),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaigns list error:", error);
      throw new AppError("ADMIN_CAMPAIGNS_LIST_ERROR", 500, "Kampanyalar getirilemedi");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const name = String(req.body?.name ?? "").trim();
      const audience = AdminCampaignsController.normalizeAudience(req.body?.audience);
      const triggerType = String(req.body?.trigger_type ?? "").trim().toUpperCase() as CampaignTriggerType;
      const triggerCount = Math.max(0, Math.floor(Number(req.body?.trigger_count) || 0));
      const rewardType = AdminCampaignsController.normalizeRewardType(req.body?.reward_type);
      const rewardValue = Math.max(0, Math.floor(Number(req.body?.reward_value) || 0));
      const rewardTarget = AdminCampaignsController.normalizeRewardTarget(
        req.body?.reward_target,
        triggerType === "REFERRAL" ? "REFERRER" : "MEMBER"
      );
      const isActive = req.body?.is_active === undefined ? true : Boolean(req.body?.is_active);

      if (!name) {
        throw new AppError("VALIDATION_ERROR", 400, "Kampanya adı zorunludur");
      }
      if (triggerType !== "REFERRAL" && triggerType !== "ATTENDANCE") {
        throw new AppError("VALIDATION_ERROR", 400, "Kampanya koşulu geçersiz");
      }
      if (triggerCount < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "Koşul adedi 1 veya daha büyük olmalıdır");
      }
      if (rewardValue < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "Ödül değeri 1 veya daha büyük olmalıdır");
      }

      const profileRepo = AppDataSource.getRepository(SalonProfile);
      const profile = await AdminCampaignsController.ensureProfile(tenantId);
      const location =
        profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? ({ ...profile.location } as Record<string, unknown>)
          : {};
      const campaigns = AdminCampaignsController.normalizeCampaigns(location.campaigns);
      const audit = AdminCampaignsController.normalizeCampaignAudit(location.campaign_audit);
      const now = new Date().toISOString();
      const rewardLabel = AdminCampaignsController.buildRewardLabel({
        triggerType,
        triggerCount,
        rewardType,
        rewardValue,
        rewardTarget,
      });

      const newRow =
        triggerType === "REFERRAL"
          ? ({
              id: `ref-${Date.now()}`,
              name,
              audience,
              trigger_type: triggerType,
              required_referrals: triggerCount,
              reward_type: rewardType,
              reward_value: rewardValue,
              reward_label: rewardLabel,
              reward_target: rewardTarget,
              is_active: isActive,
              created_at: now,
              updated_at: now,
            } satisfies ReferralCampaignRule)
          : ({
              id: `loy-${Date.now()}`,
              name,
              audience,
              trigger_type: triggerType,
              min_lessons: triggerCount,
              reward_type: rewardType,
              reward_value: rewardValue,
              reward_label: rewardLabel,
              reward_target: "MEMBER",
              is_active: isActive,
              created_at: now,
              updated_at: now,
            } satisfies LoyaltyCampaignRule);

      if (triggerType === "REFERRAL") {
        campaigns.referral_campaigns = [...campaigns.referral_campaigns, newRow as ReferralCampaignRule];
      } else {
        campaigns.loyalty_campaigns = [...campaigns.loyalty_campaigns, newRow as LoyaltyCampaignRule];
      }

      location.campaigns = campaigns;
      location.campaign_audit = [
        ...audit,
        {
          id: `audit-${Date.now()}`,
          action: "CAMPAIGN_CREATED",
          summary: `${name} kampanyası oluşturuldu`,
          actor_id: req.auth?.sub || null,
          created_at: now,
        },
      ].slice(-120);
      profile.location = location as SalonProfile["location"];

      await profileRepo.save(profile);

      return res.status(201).json({
        data: {
          campaign: newRow,
          campaigns,
          audit: location.campaign_audit,
          summary: AdminCampaignsController.buildSummary(campaigns),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign create error:", error);
      throw new AppError("ADMIN_CAMPAIGN_CREATE_ERROR", 500, "Kampanya oluşturulamadı");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const campaignId = String(req.params.id ?? "").trim();
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      if (!campaignId) throw new AppError("VALIDATION_ERROR", 400, "Kampanya id zorunludur");

      const profile = await AdminCampaignsController.ensureProfile(tenantId);
      const location =
        profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? (profile.location as Record<string, unknown>)
          : {};
      const campaigns = AdminCampaignsController.normalizeCampaigns(location.campaigns);
      const found = AdminCampaignsController.findCampaignById(campaigns, campaignId);
      if (!found) {
        throw new AppError("CAMPAIGN_NOT_FOUND", 404, "Kampanya bulunamadi");
      }

      return res.json({
        data: {
          campaign: found.item,
          campaign_type: found.collectionType,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign detail error:", error);
      throw new AppError("ADMIN_CAMPAIGN_DETAIL_ERROR", 500, "Kampanya detayı getirilemedi");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const campaignId = String(req.params.id ?? "").trim();
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      if (!campaignId) throw new AppError("VALIDATION_ERROR", 400, "Kampanya id zorunludur");

      const profileRepo = AppDataSource.getRepository(SalonProfile);
      const profile = await AdminCampaignsController.ensureProfile(tenantId);
      const location =
        profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? ({ ...profile.location } as Record<string, unknown>)
          : {};
      const campaigns = AdminCampaignsController.normalizeCampaigns(location.campaigns);
      const audit = AdminCampaignsController.normalizeCampaignAudit(location.campaign_audit);
      const found = AdminCampaignsController.findCampaignById(campaigns, campaignId);
      if (!found) {
        throw new AppError("CAMPAIGN_NOT_FOUND", 404, "Kampanya bulunamadi");
      }

      const current = found.item;
      const name =
        req.body?.name === undefined ? current.name || "" : String(req.body?.name ?? "").trim();
      const audience =
        req.body?.audience === undefined ? current.audience || "ALL" : AdminCampaignsController.normalizeAudience(req.body?.audience);
      const triggerCount =
        req.body?.trigger_count === undefined
          ? found.collectionType === "REFERRAL"
            ? (current as ReferralCampaignRule).required_referrals
            : (current as LoyaltyCampaignRule).min_lessons
          : Math.max(0, Math.floor(Number(req.body?.trigger_count) || 0));
      const rewardType =
        req.body?.reward_type === undefined
          ? AdminCampaignsController.normalizeRewardType(current.reward_type)
          : AdminCampaignsController.normalizeRewardType(req.body?.reward_type);
      const rewardValue =
        req.body?.reward_value === undefined
          ? Math.max(0, Math.floor(Number(current.reward_value) || 0))
          : Math.max(0, Math.floor(Number(req.body?.reward_value) || 0));
      const rewardTarget =
        found.collectionType === "REFERRAL"
          ? req.body?.reward_target === undefined
            ? AdminCampaignsController.normalizeRewardTarget(current.reward_target, "REFERRER")
            : AdminCampaignsController.normalizeRewardTarget(req.body?.reward_target, "REFERRER")
          : "MEMBER";
      const isActive =
        req.body?.is_active === undefined ? Boolean(current.is_active) : Boolean(req.body?.is_active);

      if (!name) {
        throw new AppError("VALIDATION_ERROR", 400, "Kampanya adı zorunludur");
      }
      if (triggerCount < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "Koşul adedi 1 veya daha büyük olmalıdır");
      }
      if (rewardValue < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "Ödül değeri 1 veya daha büyük olmalıdır");
      }

      const now = new Date().toISOString();
      const rewardLabel = AdminCampaignsController.buildRewardLabel({
        triggerType: found.collectionType,
        triggerCount,
        rewardType,
        rewardValue,
        rewardTarget,
      });

      if (found.collectionType === "REFERRAL") {
        const updatedRow: ReferralCampaignRule = {
          ...(current as ReferralCampaignRule),
          name,
          audience,
          trigger_type: "REFERRAL",
          required_referrals: triggerCount,
          reward_type: rewardType,
          reward_value: rewardValue,
          reward_label: rewardLabel,
          reward_target: rewardTarget,
          is_active: isActive,
          updated_at: now,
        };
        campaigns.referral_campaigns[found.index] = updatedRow;
        location.campaigns = campaigns;
        location.campaign_audit = [
          ...audit,
          {
            id: `audit-${Date.now()}`,
            action: "CAMPAIGN_UPDATED",
            summary: `${name} kampanyası güncellendi`,
            actor_id: req.auth?.sub || null,
            created_at: now,
          },
        ].slice(-120);
        profile.location = location as SalonProfile["location"];

        await profileRepo.save(profile);

        return res.json({
          data: {
            campaign: updatedRow,
            campaigns,
            audit: location.campaign_audit,
            summary: AdminCampaignsController.buildSummary(campaigns),
          },
        });
      } else {
        const updatedRow: LoyaltyCampaignRule = {
          ...(current as LoyaltyCampaignRule),
          name,
          audience,
          trigger_type: "ATTENDANCE",
          min_lessons: triggerCount,
          reward_type: rewardType,
          reward_value: rewardValue,
          reward_label: rewardLabel,
          reward_target: "MEMBER",
          is_active: isActive,
          updated_at: now,
        };
        campaigns.loyalty_campaigns[found.index] = updatedRow;
        location.campaigns = campaigns;
        location.campaign_audit = [
          ...audit,
          {
            id: `audit-${Date.now()}`,
            action: "CAMPAIGN_UPDATED",
            summary: `${name} kampanyası güncellendi`,
            actor_id: req.auth?.sub || null,
            created_at: now,
          },
        ].slice(-120);
        profile.location = location as SalonProfile["location"];

        await profileRepo.save(profile);

        return res.json({
          data: {
            campaign: updatedRow,
            campaigns,
            audit: location.campaign_audit,
            summary: AdminCampaignsController.buildSummary(campaigns),
          },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign update error:", error);
      throw new AppError("ADMIN_CAMPAIGN_UPDATE_ERROR", 500, "Kampanya güncellenemedi");
    }
  }
}
