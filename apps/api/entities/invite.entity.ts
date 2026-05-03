// Bu TypeORM entity'si veritabanindaki invite.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";
import { UserRole } from "./user.entity";

export enum InviteStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
}

@Entity("invites")
export class Invite extends TenantScopedEntity {
  @Index()
  @Column({ type: "enum", enum: UserRole })
  role!: UserRole;

  @Index()
  @Column({ type: "varchar", length: 140 })
  email_or_phone!: string;

  @Index()
  @Column({ type: "varchar", length: 128, unique: true })
  token_hash!: string;

  @Column({ type: "timestamptz" })
  expires_at!: Date;

  @Index()
  @Column({ type: "enum", enum: InviteStatus, default: InviteStatus.PENDING })
  status!: InviteStatus;

  @Column({ type: "uuid" })
  invited_by_admin_id!: string;

  @Column({ type: "uuid", nullable: true })
  accepted_user_id?: string;

  @Column({ type: "timestamptz", nullable: true })
  accepted_at?: Date;

  @Column({ type: "timestamptz", nullable: true })
  canceled_at?: Date;

  @Column({ type: "jsonb", default: {} })
  meta!: Record<string, unknown>;
}
