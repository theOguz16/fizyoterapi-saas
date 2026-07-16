// Bu TypeORM entity'si veritabanindaki notification event.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum NotificationEventStatus {
  QUEUED = "QUEUED",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
}

@Entity("notification_events")
export class NotificationEvent extends TenantScopedEntity {
  @Index()
  @Column({ type: "varchar", length: 80 })
  type!: string;

  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "jsonb", default: {} })
  payload!: Record<string, unknown>;

  @Index()
  @Column({ type: "enum", enum: NotificationEventStatus, default: NotificationEventStatus.QUEUED })
  status!: NotificationEventStatus;

  @Column({ type: "uuid", nullable: true })
  triggered_by_admin_id?: string;

  @Column({ type: "timestamptz", nullable: true })
  processed_at?: Date;

  @Column({ type: "varchar", length: 240, nullable: true })
  error_message?: string | null;
}
