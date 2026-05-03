// Bu TypeORM entity'si veritabanindaki referral.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum ReferralStatus {
  INVITED = "INVITED",
  CONVERTED = "CONVERTED",
  REWARDED = "REWARDED",
  CANCELED = "CANCELED",
}

@Entity("referrals")
export class Referral extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  inviter_member_id!: string;

  @Index()
  @Column({ type: "varchar", length: 120 })
  invitee_phone_or_email!: string;

  @Column({ type: "varchar", length: 40 })
  code!: string;

  @Column({ type: "enum", enum: ReferralStatus, default: ReferralStatus.INVITED })
  status!: ReferralStatus;

  @Column({ type: "timestamptz", nullable: true })
  converted_at?: Date;
}