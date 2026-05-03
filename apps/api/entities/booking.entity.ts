// Bu TypeORM entity'si veritabanindaki booking.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum BookingStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  CANCELED = "CANCELED",
  RESCHEDULED = "RESCHEDULED",
}

export enum BookingPaymentStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum BookingCheckinStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

@Entity("bookings")
export class Booking extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Index()
  @Column({ type: "uuid", nullable: true })
  session_id?: string; // onaylanınca session oluşabilir veya bağlanır

  @Column({ type: "timestamptz" })
  starts_at!: Date;

  @Column({ type: "timestamptz" })
  ends_at!: Date;

  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: "enum", enum: BookingPaymentStatus, default: BookingPaymentStatus.REQUESTED })
  payment_status!: BookingPaymentStatus;

  @Column({ type: "timestamptz", nullable: true })
  payment_requested_at?: Date;

  @Column({ type: "timestamptz", nullable: true })
  payment_approved_at?: Date;

  @Index()
  @Column({ type: "uuid", nullable: true })
  payment_approved_by_admin_id?: string;

  @Column({
  type: "enum",
  enum: BookingCheckinStatus,
  default: BookingCheckinStatus.PENDING,
})
  checkin_status!: BookingCheckinStatus;

  @Column({ type: "timestamptz", nullable: true })
  checked_in_at?: Date | null;

  @Index()
  @Column({ type: "uuid", nullable: true })
  checked_in_by_trainer_id?: string | null;

  @Index()
  @Column({ type: "uuid", nullable: true })
  checked_in_user_package_id?: string | null;

  @Column({ type: "int", default: 0 })
  credits_charged!: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  trainer_earning_amount?: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  payment_note?: string;

  @Column({ type: "jsonb", default: {} })
  meta!: Record<string, any>;
}
