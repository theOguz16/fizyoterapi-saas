// Bu TypeORM entity'si veritabanindaki retention score.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("retention_scores")
export class RetentionScore extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "int" })
  score!: number; // 0-100

  @Column({ type: "jsonb", default: {} })
  breakdown!: Record<string, any>; // devamsızlık, ölçüm güncelliği, yenileme, referans...

  @Column({ type: "timestamptz" })
  calculated_at!: Date;
}