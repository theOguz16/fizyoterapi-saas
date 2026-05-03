// Bu TypeORM entity'si veritabanindaki trainer member note.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("trainer_member_notes")
@Index(["tenant_id", "trainer_id", "member_id"], { unique: true })
export class TrainerMemberNote extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "text", default: "" })
  note!: string;
}
