// Bu TypeORM entity'si veritabanindaki device token.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum DevicePlatform {
  IOS = "IOS",
  ANDROID = "ANDROID",
  WEB = "WEB",
}

@Entity("device_tokens")
export class DeviceToken extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "enum", enum: DevicePlatform })
  platform!: DevicePlatform;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  token!: string;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  last_seen_at?: Date;
}
