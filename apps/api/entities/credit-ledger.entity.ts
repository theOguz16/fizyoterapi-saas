// Bu TypeORM entity'si veritabanindaki credit ledger.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum CreditLedgerSource {
  REFERRAL_REWARD = "REFERRAL_REWARD",
  CHECKIN_USE = "CHECKIN_USE",
  MANUAL_ADJUST = "MANUAL_ADJUST",
}

@Entity("credit_ledger")
export class CreditLedger extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "int" })
  delta!: number;

  @Column({ type: "int" })
  balance_after!: number;

  @Column({ type: "enum", enum: CreditLedgerSource })
  source!: CreditLedgerSource;

  @Column({ type: "varchar", length: 120, nullable: true })
  reference_type?: string;

  @Column({ type: "uuid", nullable: true })
  reference_id?: string;

  @Column({ type: "jsonb", default: {} })
  meta!: Record<string, unknown>;
}
