// Bu TypeORM entity'si veritabanindaki salon image.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum SalonImageType {
  HERO = "HERO",
  GALLERY = "GALLERY",
}

@Index(["tenant_id", "type"])
@Index(["tenant_id", "type", "sort_order"])
@Entity("salon_images")
export class SalonImage extends TenantScopedEntity {
  @Column({ type: "enum", enum: SalonImageType, default: SalonImageType.GALLERY })
  type!: SalonImageType;

  @Column({ type: "varchar", length: 500 })
  url!: string;

  @Column({ type: "int", default: 0 })
  sort_order!: number;

  @Column({ type: "jsonb", default: {} })
  meta!: Record<string, any>;
}