// Bu TypeORM entity'si veritabanindaki notification template.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum NotificationType {
  PACKAGE_ENDING = "PACKAGE_ENDING",
  MEASUREMENT_DUE = "MEASUREMENT_DUE",
  SESSION_REMINDER = "SESSION_REMINDER",
}

@Entity("notification_templates")
export class NotificationTemplate extends TenantScopedEntity {
  @Index()
  @Column({ type: "enum", enum: NotificationType })
  type!: NotificationType;

  @Column({ type: "varchar", length: 140 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb", nullable: true, default: {} })
  settings?: {
    mode?: "INSTANT" | "SCHEDULED";
    cadence?: "DAILY" | "WEEKLY" | "EVERY_3_DAYS";
    next_run_at?: string | null;
  };

  @Column({ type: "boolean", default: true })
  is_active!: boolean;
}
