// Bu TypeORM entity'si veritabanindaki member credit wallet.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("member_credit_wallets")
export class MemberCreditWallet extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "int", default: 0 })
  referral_group_credits!: number;
}
