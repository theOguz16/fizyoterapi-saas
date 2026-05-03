// Bu TypeORM entity'si veritabanindaki base.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from "typeorm";

export abstract class BaseEntityWithTimestamps {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  deleted_at?: Date | null;
}

export abstract class TenantScopedEntity extends BaseEntityWithTimestamps {
  @Column({ type: "uuid" })
  tenant_id!: string;
}