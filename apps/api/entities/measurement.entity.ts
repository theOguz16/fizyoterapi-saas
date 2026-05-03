// Bu TypeORM entity'si veritabanindaki measurement.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("measurements")
export class Measurement extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Column({ type: "timestamptz" })
  measured_at!: Date;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  height_cm?: string;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  weight_kg?: string;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  fat_percent?: string;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  muscle_kg?: string;

  @Column({ type: "jsonb", default: {} })
  extras!: Record<string, any>;
}