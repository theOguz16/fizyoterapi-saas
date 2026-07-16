// Bu TypeORM entity'si veritabanindaki notification delivery.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum NotificationDeliveryChannel {
  MOCK_PUSH = "MOCK_PUSH",
  EXPO_PUSH = "EXPO_PUSH",
}

export enum NotificationDeliveryStatus {
  QUEUED = "QUEUED",
  SENDING = "SENDING",
  AWAITING_RECEIPT = "AWAITING_RECEIPT",
  RETRY_SCHEDULED = "RETRY_SCHEDULED",
  DELIVERED = "DELIVERED",
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

  @Column({ type: "enum", enum: NotificationDeliveryStatus, default: NotificationDeliveryStatus.QUEUED })
  status!: NotificationDeliveryStatus;

  @Index()
  @Column({ type: "uuid", nullable: true })
  device_token_id?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  token_snapshot?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  platform?: string | null;

  @Column({ type: "text", nullable: true })
  title?: string | null;

  @Column({ type: "text", nullable: true })
  body?: string | null;

  @Column({ type: "jsonb", default: {} })
  data!: Record<string, unknown>;

  @Index()
  @Column({ type: "varchar", length: 120, nullable: true })
  provider_ticket_id?: string | null;

  @Column({ type: "integer", default: 0 })
  attempt_count!: number;

  @Column({ type: "integer", default: 4 })
  max_attempts!: number;

  @Column({ type: "integer", default: 0 })
  receipt_attempt_count!: number;

  @Index()
  @Column({ type: "timestamptz", nullable: true })
  next_attempt_at?: Date | null;

  @Index()
  @Column({ type: "timestamptz", nullable: true })
  receipt_check_at?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  last_attempt_at?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  delivered_at?: Date | null;

  @Column({ type: "varchar", length: 240, nullable: true })
  error_message?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sent_at?: Date | null;
}
