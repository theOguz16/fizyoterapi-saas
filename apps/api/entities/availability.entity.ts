// Bu TypeORM entity'si veritabanindaki availability.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("availabilities")
export class Availability extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "timestamptz" })
  starts_at!: Date;

  @Column({ type: "timestamptz" })
  ends_at!: Date;

  @Index()
  @Column({ type: "uuid", nullable: true })
  package_id?: string;

  @Column({ type: "varchar", length: 240, nullable: true })
  note?: string;
}
