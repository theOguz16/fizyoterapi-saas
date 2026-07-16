import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";

@Entity("product_demo_leads")
@Index(["created_at"])
@Index(["deleted_at", "created_at"])
export class ProductDemoLead extends BaseEntityWithTimestamps {
  @Column({ type: "varchar", length: 160 })
  full_name!: string;

  @Column({ type: "varchar", length: 200 })
  clinic_name!: string;

  @Column({ type: "varchar", length: 254 })
  email!: string;

  @Column({ type: "varchar", length: 32 })
  phone!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  city!: string | null;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  clinic_type!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  primary_need!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  attribution!: string | null;

  @Column({ type: "varchar", length: 240, nullable: true })
  page_path!: string | null;

  @Column({ type: "varchar", length: 80, default: "PRODUCT_SITE_DEMO" })
  source!: string;

  @Index({ unique: true })
  @Column({ type: "uuid", nullable: true })
  source_audit_log_id!: string | null;
}
