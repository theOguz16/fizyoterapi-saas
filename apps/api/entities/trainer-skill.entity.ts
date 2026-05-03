// Bu TypeORM entity'si veritabanindaki trainer skill.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Column, Entity, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";
import { LessonCategory } from "./class-session.entity";

@Entity("trainer_skills")
@Index(["tenant_id", "trainer_id", "lesson_category"], { unique: true })
export class TrainerSkill extends TenantScopedEntity {
  @Index()
  @Column({ type: "uuid" })
  trainer_id!: string;

  @Index()
  @Column({ type: "enum", enum: LessonCategory })
  lesson_category!: LessonCategory;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;
}
