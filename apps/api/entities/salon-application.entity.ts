// Bu TypeORM entity'si veritabanindaki salon application.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";
import { MembershipPaymentStatus } from "./salon-membership.entity";

export enum SalonApplicationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum SalonApplicationSource {
  CATALOG = "CATALOG",
  INVITE = "INVITE",
}

@Entity("salon_applications")
@Index("IDX_salon_application_account_status", ["account_id", "status"])
@Index("IDX_salon_application_tenant_status", ["tenant_id", "status"])
export class SalonApplication extends BaseEntityWithTimestamps {
  @Index()
  @Column({ type: "uuid" })
  account_id!: string;

  @Index()
  @Column({ type: "uuid" })
  tenant_id!: string;

  @Column({ type: "enum", enum: SalonApplicationStatus, default: SalonApplicationStatus.PENDING })
  status!: SalonApplicationStatus;

  @Column({ type: "enum", enum: MembershipPaymentStatus, default: MembershipPaymentStatus.UNPAID })
  payment_status!: MembershipPaymentStatus;

  @Column({ type: "varchar", length: 160, nullable: true })
  payment_reference?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  payment_confirmed_at?: Date | null;

  @Column({ type: "text", nullable: true })
  note?: string | null;

  @Column({ type: "enum", enum: SalonApplicationSource, default: SalonApplicationSource.CATALOG })
  source!: SalonApplicationSource;

  @Column({ type: "uuid", nullable: true })
  invite_id?: string | null;
}
