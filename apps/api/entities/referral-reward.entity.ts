// Bu TypeORM entity'si veritabanindaki referral reward.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("referral_rewards")
export class ReferralReward extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  referral_id!: string;

  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "int", default: 1 })
  credits_granted!: number;

  @Column({ type: "varchar", length: 120, default: "1 davet = 1 grup dersi" })
  rule_name!: string;

  @Column({ type: "timestamptz" })
  granted_at!: Date;
}