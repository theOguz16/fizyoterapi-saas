// Bu TypeORM entity'si veritabanindaki package trainer assignment.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("package_trainer_assignments")
@Index(["tenant_id", "package_id", "trainer_id"], { unique: true })
export class PackageTrainerAssignment extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  package_id!: string;

  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;
}
