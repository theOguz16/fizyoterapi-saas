// Bu TypeORM entity'si veritabanindaki salon membership.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";
import { UserRole } from "./user.entity";

export enum SalonMembershipStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  LEFT = "LEFT",
  REJECTED = "REJECTED",
}

export enum MembershipPaymentStatus {
  UNPAID = "UNPAID",
  PAID = "PAID",
  VERIFIED = "VERIFIED",
}

@Entity("salon_memberships")
@Index("IDX_salon_membership_account_status_context", ["account_id", "status", "is_active_context"])
@Index("UQ_salon_membership_account_tenant_role", ["account_id", "tenant_id", "role"], { unique: true })
export class SalonMembership extends BaseEntityWithTimestamps {
  @Index()
  @Column({ type: "uuid" })
  account_id!: string;

  @Index()
  @Column({ type: "uuid" })
  tenant_id!: string;

  @Index()
  @Column({ type: "uuid", nullable: true })
  user_id?: string | null;

  @Column({ type: "enum", enum: UserRole })
  role!: UserRole;

  @Column({ type: "enum", enum: SalonMembershipStatus, default: SalonMembershipStatus.PENDING })
  status!: SalonMembershipStatus;

  @Column({ type: "enum", enum: MembershipPaymentStatus, default: MembershipPaymentStatus.UNPAID })
  payment_status!: MembershipPaymentStatus;

  @Column({ type: "uuid", nullable: true })
  approved_by?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  approved_at?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  left_at?: Date | null;

  @Column({ type: "boolean", default: false })
  is_active_context!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  joined_at?: Date | null;
}
