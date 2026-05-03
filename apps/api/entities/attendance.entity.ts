// Bu TypeORM entity'si veritabanindaki attendance.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.

import { Entity, Column, Index} from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum AttendanceResult {
    CREDIT_DEDUCTED = "CREDIT_DEDUCTED",
    NO_CREDIT = "NO_CREDIT",
    PACKAGE_EXPIRED = "PACKAGE_EXPIRED",
    USER_INACTIVE = "USER_INACTIVE",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
}

@Entity("attendance")
export class Attendance extends TenantScopedEntity {
    @Index()
    @Column({ type: "uuid" })
    member_id!: string; // MEMBER user

    @Index()
    @Column({ type: "uuid" })
    trainer_id!: string;

    @Index()
    @Column({ type: "uuid", nullable: true })
    session_id?: string;

    @Index()
    @Column({ type: "uuid", nullable: true })
    booking_id?: string | null;

    @Index()
    @Column({ type: "uuid", nullable: true })
    user_package_id?: string;

    @Column({type: "int", default: 0})
    credits_deducted!: number; // Kaç kredi kesildi (0 ise giriş yapıldı ama kredi kesilmedi) genelde 1 olur

    @Column({ type: "enum", enum: AttendanceResult })
    result!: AttendanceResult;

    @Column({ type: "varchar", length: 80, nullable: true })
    manual_code?: string; // fallback kod

    @Column({ type: "jsonb", default: {} })
    meta!: Record<string, any>;
}