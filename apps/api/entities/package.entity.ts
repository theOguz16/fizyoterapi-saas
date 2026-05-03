// Bu TypeORM entity'si veritabanindaki package.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum PackageType {
  GROUP = "GROUP",
  PT = "PT",
  REFORMER = "REFORMER",
  MANUAL = "MANUAL",
  SCOLIOSIS = "SCOLIOSIS",
  OTHER = "OTHER",
}

@Entity("packages")
export class Package extends TenantScopedEntity {
  @Index()
  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "enum", enum: PackageType, default: PackageType.OTHER })
  type!: PackageType;

  @Column({ type: "int" })
  total_credits!: number; // toplam ders hakkı

  @Column({ type: "int", default: 0 })
  duration_days!: number; // 0 = süresiz

  @Column({ type: "int", default: 0 })
  capacity!: number; // grup ders kapasitesi (0 = N/A)

  @Column({ type: "jsonb", default: {} })
  rules!: Record<string, any>; // esnek kurallar (iptal, limit vs.)

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  display_price?: string; // sadece gösterim

  @Column({ type: "boolean", default: true })
  is_active!: boolean; 

  @Column({ type: "boolean", default: true})
  is_visible!: boolean; // müşteriye görünür mü

  @Column({ type: "boolean", default: false })
  is_public!: boolean; // landing page'de görünsün mü
}