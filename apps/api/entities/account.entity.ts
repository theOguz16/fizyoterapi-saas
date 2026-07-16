// Bu TypeORM entity'si veritabanindaki account.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";
import { UserRole } from "./user.entity";
import type { StoredRegistrationLegalConsent } from "@fitnes-saas/contracts";

@Entity("accounts")
export class Account extends BaseEntityWithTimestamps {
  @Column({ type: "jsonb", nullable: true })
  onboarding_profile?:
    | {
        role: UserRole;
        primary_goal: string;
        rhythm: string;
        support_style: string;
      }
    | null;

  @Column({ type: "jsonb", nullable: true })
  notification_preferences?: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  legal_consents?: StoredRegistrationLegalConsent | null;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 140 })
  email!: string;

  @Column({ type: "varchar", length: 120 })
  password_hash!: string;

  @Column({ type: "varchar", length: 120 })
  first_name!: string;

  @Column({ type: "varchar", length: 120 })
  last_name!: string;

  @Index()
  @Column({ type: "varchar", length: 32 })
  phone!: string;

  @Column({ type: "enum", enum: UserRole, nullable: true })
  global_role_default?: UserRole | null;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;
}
