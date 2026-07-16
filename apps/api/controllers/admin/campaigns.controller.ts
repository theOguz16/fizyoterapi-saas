import { Response } from "express";
import { AppDataSource } from "../../data-source";
import {
  Campaign,
  CampaignAudience,
  CampaignFulfillmentType,
  CampaignRewardType,
  CampaignTriggerType,
} from "../../entities/campaign.entity";
import { CreditLedger } from "../../entities/credit-ledger.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { CampaignEngineService } from "../../services/campaign-engine.service";

export class AdminCampaignsController {
  private static parseInput(body: Record<string, unknown>, current?: Campaign) {
    const triggerType = body.trigger_type === undefined
      ? current?.trigger_type ?? null
      : CampaignEngineService.normalizeTrigger(body.trigger_type);
    if (!triggerType) throw new AppError("VALIDATION_ERROR", 400, "Kampanya koşulu geçersiz");

    if (body.reward_type !== undefined && !CampaignEngineService.isSupportedReward(body.reward_type)) {
      throw new AppError(
        "CAMPAIGN_REWARD_NOT_FULFILLABLE",
        400,
        "İndirim ödülü satın alma fiyatına uygulanmadığı için kullanılamaz. Ücretsiz grup dersi seçin."
      );
    }
    const name = body.name === undefined ? current?.name ?? "" : String(body.name ?? "").trim();
    const triggerCount = body.trigger_count === undefined
      ? current?.trigger_count ?? 0
      : Math.floor(Number(body.trigger_count));
    const rewardValue = body.reward_value === undefined
      ? current?.reward_value ?? 0
      : Math.floor(Number(body.reward_value));
    if (!name) throw new AppError("VALIDATION_ERROR", 400, "Kampanya adı zorunludur");
    if (!Number.isFinite(triggerCount) || triggerCount < 1) {
      throw new AppError("VALIDATION_ERROR", 400, "Koşul adedi 1 veya daha büyük olmalıdır");
    }
    if (!Number.isFinite(rewardValue) || rewardValue < 1) {
      throw new AppError("VALIDATION_ERROR", 400, "Ödül adedi 1 veya daha büyük olmalıdır");
    }

    const isActive = body.is_active === undefined ? current?.is_active ?? false : body.is_active === true;
    return {
      name,
      audience: body.audience === undefined
        ? current?.audience ?? CampaignAudience.ALL
        : CampaignEngineService.normalizeAudience(body.audience),
      audience_config: current?.audience_config ?? {},
      trigger_type: triggerType,
      trigger_count: triggerCount,
      reward_type: CampaignRewardType.GROUP_CLASS_CREDIT,
      reward_value: rewardValue,
      reward_target: CampaignEngineService.normalizeTarget(
        body.reward_target === undefined ? current?.reward_target : body.reward_target,
        triggerType
      ),
      fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
      is_active: isActive,
      activated_at: isActive ? current?.activated_at ?? new Date() : null,
    };
  }

  private static serialize(campaign: Campaign) {
    const labels = CampaignEngineService.buildRuleLabels(campaign);
    return {
      ...campaign,
      ...labels,
      required_referrals: campaign.trigger_type === CampaignTriggerType.REFERRAL ? campaign.trigger_count : null,
      min_lessons: campaign.trigger_type === CampaignTriggerType.ATTENDANCE ? campaign.trigger_count : null,
    };
  }

  private static buildResponse(items: Array<Campaign & Partial<{ fulfillment_count: number; fulfilled_credits: number; last_fulfilled_at: Date | null }>>) {
    const serialized = items.map((item) => ({ ...AdminCampaignsController.serialize(item),
      fulfillment_count: item.fulfillment_count ?? 0,
      fulfilled_credits: item.fulfilled_credits ?? 0,
      last_fulfilled_at: item.last_fulfilled_at ?? null,
    }));
    const referral = serialized.filter((item) => item.trigger_type === CampaignTriggerType.REFERRAL);
    const loyalty = serialized.filter((item) => item.trigger_type === CampaignTriggerType.ATTENDANCE);
    return {
      campaigns: { referral_campaigns: referral, loyalty_campaigns: loyalty },
      items: serialized,
      summary: {
        total: serialized.length,
        active: serialized.filter((item) => item.is_active).length,
        referral: referral.length,
        loyalty: loyalty.length,
      },
    };
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      const campaigns = await CampaignEngineService.list(req.tenantId);
      const items = await CampaignEngineService.withFulfillmentSummary(campaigns);
      return res.json({ data: AdminCampaignsController.buildResponse(items) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaigns list error:", error);
      throw new AppError("ADMIN_CAMPAIGNS_LIST_ERROR", 500, "Kampanyalar getirilemedi");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      const values = AdminCampaignsController.parseInput(req.body ?? {});
      const repo = AppDataSource.getRepository(Campaign);
      const campaign = await repo.save(repo.create({
        tenant_id: req.tenantId,
        created_by_admin_id: req.auth?.linkedUserId || req.auth?.sub || null,
        ...values,
      }));
      return res.status(201).json({ data: { campaign: AdminCampaignsController.serialize(campaign) } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign create error:", error);
      throw new AppError("ADMIN_CAMPAIGN_CREATE_ERROR", 500, "Kampanya oluşturulamadı");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      await CampaignEngineService.ensureLegacyMigrated(req.tenantId);
      const campaign = await AppDataSource.getRepository(Campaign).findOne({
        where: { id: String(req.params.id), tenant_id: req.tenantId },
      });
      if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", 404, "Kampanya bulunamadı");
      const [view] = await CampaignEngineService.withFulfillmentSummary([campaign]);
      return res.json({ data: { campaign: AdminCampaignsController.serialize(view), campaign_type: campaign.trigger_type } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign detail error:", error);
      throw new AppError("ADMIN_CAMPAIGN_DETAIL_ERROR", 500, "Kampanya detayı getirilemedi");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      await CampaignEngineService.ensureLegacyMigrated(req.tenantId);
      const repo = AppDataSource.getRepository(Campaign);
      const campaign = await repo.findOne({ where: { id: String(req.params.id), tenant_id: req.tenantId } });
      if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", 404, "Kampanya bulunamadı");
      const changesFulfillmentRule = ["audience", "trigger_count", "reward_type", "reward_value", "reward_target"]
        .some((field) => req.body?.[field] !== undefined);
      if (changesFulfillmentRule) {
        const fulfilled = await AppDataSource.getRepository(CreditLedger).count({
          where: { tenant_id: req.tenantId, reference_type: "CAMPAIGN", reference_id: campaign.id },
        });
        if (fulfilled > 0) {
          throw new AppError(
            "CAMPAIGN_RULE_IMMUTABLE_AFTER_FULFILLMENT",
            409,
            "Ödül teslim edilmiş kampanyanın kuralı değiştirilemez. Kampanyayı pasife alıp yeni kampanya oluşturun."
          );
        }
      }
      Object.assign(campaign, AdminCampaignsController.parseInput(req.body ?? {}, campaign));
      const saved = await repo.save(campaign);
      return res.json({ data: { campaign: AdminCampaignsController.serialize(saved) } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin campaign update error:", error);
      throw new AppError("ADMIN_CAMPAIGN_UPDATE_ERROR", 500, "Kampanya güncellenemedi");
    }
  }
}
