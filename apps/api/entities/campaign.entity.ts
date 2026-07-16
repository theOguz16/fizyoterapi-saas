import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum CampaignAudience {
  ALL = "ALL",
  RISK = "RISK",
  NEW = "NEW",
}

export enum CampaignTriggerType {
  REFERRAL = "REFERRAL",
  ATTENDANCE = "ATTENDANCE",
}

export enum CampaignRewardType {
  GROUP_CLASS_CREDIT = "GROUP_CLASS_CREDIT",
}

export enum CampaignRewardTarget {
  REFERRER = "REFERRER",
  REFERRED = "REFERRED",
  BOTH = "BOTH",
  MEMBER = "MEMBER",
}

export enum CampaignFulfillmentType {
  MEMBER_CREDIT_WALLET = "MEMBER_CREDIT_WALLET",
}

@Entity("campaigns")
@Index("IDX_campaigns_tenant_trigger_active", ["tenant_id", "trigger_type", "is_active"])
@Index("UQ_campaigns_tenant_legacy_id", ["tenant_id", "legacy_id"], { unique: true, where: "legacy_id IS NOT NULL" })
export class Campaign extends TenantScopedEntity {
  @Column({ type: "varchar", length: 140 })
  name!: string;

  @Column({ type: "varchar", length: 20 })
  audience!: CampaignAudience;

  @Column({ type: "jsonb", default: {} })
  audience_config!: { new_member_days?: number; risk_score_max?: number };

  @Column({ type: "varchar", length: 24 })
  trigger_type!: CampaignTriggerType;

  @Column({ type: "int" })
  trigger_count!: number;

  @Column({ type: "varchar", length: 40 })
  reward_type!: CampaignRewardType;

  @Column({ type: "int" })
  reward_value!: number;

  @Column({ type: "varchar", length: 24 })
  reward_target!: CampaignRewardTarget;

  @Column({ type: "varchar", length: 40 })
  fulfillment_type!: CampaignFulfillmentType;

  @Column({ type: "boolean", default: false })
  is_active!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  activated_at?: Date | null;

  @Column({ type: "uuid", nullable: true })
  created_by_admin_id?: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  legacy_id?: string | null;
}
