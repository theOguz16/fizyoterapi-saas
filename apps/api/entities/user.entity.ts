// Bu TypeORM entity'si veritabanindaki user.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

export enum UserRole {
    ADMIN = "ADMIN",
    TRAINER = "TRAINER",
    MEMBER = "MEMBER",
}

@Entity("users")
@Index("UQ_users_tenant_email_role", ["tenant_id", "email", "role"], { unique: true })
@Index("UQ_users_tenant_qr_code", ["tenant_id", "qr_code"], { unique: true, where: "qr_code IS NOT NULL" })
export class User extends TenantScopedEntity {
    @Index()
    @Column({ type: "varchar", length: 140 })
    email!: string;

    @Column({ type: "varchar", length: 120 })
    password_hash!: string;

    @Column({ type: "varchar", length: 120 })
    first_name!: string;

    @Column({ type: "varchar", length: 120 })
    last_name!: string;

    @Column({ type: "enum", enum: UserRole, default: UserRole.MEMBER })
    role!: UserRole;

    @Index()
    @Column({ type: "varchar", length: 32})
    phone!: string;

    @Index()
    @Column({ type: "varchar", length: 64, nullable:true})
    qr_code?: string; // Üye için sabit QR kod token'ı (tenant içi unique yap)

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @Column({ type: "int", nullable: true, default: 1 })
    weekly_class_hours?: number | null;
}
