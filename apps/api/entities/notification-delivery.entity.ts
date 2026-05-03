// Bu TypeORM entity'si veritabanindaki notification delivery.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum NotificationDeliveryChannel {
  MOCK_PUSH = "MOCK_PUSH",
}

export enum NotificationDeliveryStatus {
  SENT = "SENT",
  FAILED = "FAILED",
}

@Entity("notification_deliveries")
export class NotificationDelivery extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  event_id!: string;

  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "enum", enum: NotificationDeliveryChannel, default: NotificationDeliveryChannel.MOCK_PUSH })
  channel!: NotificationDeliveryChannel;

  @Column({ type: "enum", enum: NotificationDeliveryStatus, default: NotificationDeliveryStatus.SENT })
  status!: NotificationDeliveryStatus;

  @Column({ type: "varchar", length: 240, nullable: true })
  error_message?: string;

  @Column({ type: "timestamptz", nullable: true })
  sent_at?: Date;
}
