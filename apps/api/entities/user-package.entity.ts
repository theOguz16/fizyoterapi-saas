// Bu TypeORM entity'si veritabanindaki user package.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("user_packages")
@Index(["tenant_id", "user_id"])
export class UserPackage extends TenantScopedEntity {
  @Column({ type: "uuid" })
  user_id!: string; // MEMBER user

  @Column({ type: "uuid" })
  package_id!: string;

  @Column({ type: "int" })
  remaining_credits!: number;

  @Column({ type: "timestamptz", nullable: true })
  starts_at?: Date;

  @Column({ type: "timestamptz", nullable: true })
  expires_at?: Date;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  purchase_price?: string | null;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  latest_package_price?: string | null;

  @Column({ type: "jsonb", default: {} })
  package_snapshot!: Record<string, unknown>;

  @Column({ type: "varchar", length: 120, nullable: true })
  source_request_id?: string | null;
}
