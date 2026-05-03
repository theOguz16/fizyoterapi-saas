// Bu TypeORM entity'si veritabanindaki lead.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  WON = "WON",
  LOST = "LOST",
}

@Entity("leads")
export class Lead extends TenantScopedEntity {
  @Index()
  @Column({ type: "varchar", length: 120 })
  full_name!: string;

  @Index()
  @Column({ type: "varchar", length: 32 })
  phone!: string;

  @Column({ type: "varchar", length: 80, nullable: true })
  interest?: string;

  @Column({ type: "text", nullable: true })
  availability_note?: string;

  @Column({ type: "enum", enum: LeadStatus, default: LeadStatus.NEW })
  status!: LeadStatus;
}