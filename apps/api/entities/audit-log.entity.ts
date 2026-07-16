import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";

@Entity("audit_logs")
@Index(["tenant_id", "created_at"])
@Index(["actor_role", "created_at"])
@Index(["event_type", "created_at"])
export class AuditLog extends BaseEntityWithTimestamps {
  @Column({ type: "uuid", nullable: true })
  tenant_id!: string | null;

  @Column({ type: "uuid", nullable: true })
  actor_user_id!: string | null;

  @Column({ type: "uuid", nullable: true })
  actor_account_id!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  actor_role!: string | null;

  @Column({ type: "varchar", length: 80 })
  event_type!: string;

  @Column({ type: "varchar", length: 120 })
  action!: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  method!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  path!: string | null;

  @Column({ type: "int", nullable: true })
  status_code!: number | null;

  @Column({ type: "boolean", nullable: true })
  success!: boolean | null;

  @Column({ type: "int", nullable: true })
  duration_ms!: number | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  request_id!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  ip_address!: string | null;

  @Column({ type: "text", nullable: true })
  user_agent!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  target_type!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  target_id!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  error_code!: string | null;

  @Column({ type: "text", nullable: true })
  error_message!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  product_event_name!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  product_event_id!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  product_funnel_id!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  product_install_id!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  product_session_id!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  product_occurred_at!: Date | null;
}
