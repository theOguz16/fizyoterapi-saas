// Bu TypeORM entity'si veritabanindaki tenant.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";

export enum TenantReviewStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  PUBLISHED = "PUBLISHED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
}

export enum TenantSubscriptionStatus {
  INACTIVE = "INACTIVE",
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  READ_ONLY = "READ_ONLY",
}

@Entity("tenants")
export class Tenant extends BaseEntityWithTimestamps {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 80 })
  slug!: string; // isletmeismi (public URL)

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({ type: "varchar", length: 60, nullable: true })
  timezone?: string; // default Europe/Istanbul

  @Column({ type: "boolean", default: true })
  is_active!: boolean;

  @Index()
  @Column({ type: "uuid", nullable: true })
  owner_account_id?: string | null;

  @Index()
  @Column({ type: "enum", enum: TenantReviewStatus, default: TenantReviewStatus.PENDING_REVIEW })
  review_status!: TenantReviewStatus;

  @Index()
  @Column({ type: "enum", enum: TenantSubscriptionStatus, default: TenantSubscriptionStatus.INACTIVE })
  subscription_status!: TenantSubscriptionStatus;

  @Index()
  @Column({ type: "boolean", default: false })
  is_public!: boolean;

  @Column({ type: "uuid", nullable: true })
  reviewed_by_account_id?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewed_at?: Date | null;

  @Column({ type: "text", nullable: true })
  review_note?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  trial_starts_at?: Date | null;

  @Index()
  @Column({ type: "timestamptz", nullable: true })
  trial_ends_at?: Date | null;

  @Index()
  @Column({ type: "timestamptz", nullable: true })
  boost_until?: Date | null;

  @Index()
  @Column({ type: "varchar", length: 64, nullable: true })
  qr_code?: string;
}
