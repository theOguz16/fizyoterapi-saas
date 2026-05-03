// Bu TypeORM entity'si veritabanindaki trainer member note history.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("trainer_member_note_history")
@Index(["tenant_id", "trainer_id", "member_id", "created_at"])
export class TrainerMemberNoteHistory extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Index()
  @Column({ type: "uuid" })
  member_id!: string;

  @Column({ type: "text" })
  note!: string;
}
