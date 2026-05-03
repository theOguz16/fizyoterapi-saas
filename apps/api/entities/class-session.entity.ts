// Bu TypeORM entity'si veritabanindaki class session.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum SessionType {
  GROUP = "GROUP",
  PT = "PT",
}

export enum SessionStatus {
    SCHEDULED = "SCHEDULED",
    COMPLETED = "COMPLETED",
    CANCELED = "CANCELED",
    PENDING = "PENDING",
}

export enum GroupClassNotificationScope {
    SALON_MEMBERS = "SALON_MEMBERS",
    INVITED_MEMBERS = "INVITED_MEMBERS",
}

export enum LessonCategory {
    GRUP = "GRUP",
    PT = "PT",
    SKOLYOZ = "SKOLYOZ",
    PILATES = "PILATES",
    REFORMER = "REFORMER",
}

@Entity("class_sessions")
export class ClassSession extends TenantScopedEntity {
    @Index()
    @Column({ type: "enum", enum: SessionType })
    type!: SessionType;

    @Index()
    @Column({ type: "enum", enum: SessionStatus, default: SessionStatus.SCHEDULED })
    status!: SessionStatus;

    @Column({ type: "uuid", nullable: true })
    trainer_id?: string;

    @Column({ type: "uuid", nullable: true })
    related_package_id?: string; // grup ders hangi paketle uyumlu

    @Column({ type: "varchar", length: 120 })
    title!: string;

    @Column({ type: "timestamptz" })
    starts_at!: Date;

    @Column({ type: "timestamptz" })
    ends_at!: Date;

    @Column({ type: "int", default: 0 })
    capacity!: number;

    @Index()
    @Column({ type: "enum", enum: LessonCategory, default: LessonCategory.GRUP })
    lesson_category!: LessonCategory;

    @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
    price?: string | null;

    @Column({ type: "enum", enum: GroupClassNotificationScope, default: GroupClassNotificationScope.SALON_MEMBERS })
    notification_scope!: GroupClassNotificationScope;

    @Column({ type: "boolean", default: true })
    requires_admin_approval!: boolean;

    @Column({ type: "int", default: 0 })
    invited_member_count!: number;

    @Column({ type: "varchar", length: 120, nullable: true })
    recurrence_label?: string | null;

    @Column({ type: "date", nullable: true })
    special_date?: string | null;

    @Column({ type: "jsonb", default: {} })
    meta!: Record<string, unknown>;
}
