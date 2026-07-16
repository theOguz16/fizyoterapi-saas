import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";

export enum BackgroundJobType {
  GROUP_CLASS_REMINDER_SCAN = "GROUP_CLASS_REMINDER_SCAN",
  TRIAL_SUBSCRIPTION_REMINDER_SCAN = "TRIAL_SUBSCRIPTION_REMINDER_SCAN",
  PRODUCT_DEMO_LEAD_RETENTION = "PRODUCT_DEMO_LEAD_RETENTION",
}

export enum BackgroundJobStatus {
  READY = "READY",
  RUNNING = "RUNNING",
}

@Entity("background_jobs")
export class BackgroundJob extends BaseEntityWithTimestamps {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  key!: string;

  @Column({ type: "varchar", length: 80 })
  type!: BackgroundJobType;

  @Index()
  @Column({ type: "varchar", length: 20, default: BackgroundJobStatus.READY })
  status!: BackgroundJobStatus;

  @Column({ type: "integer" })
  interval_seconds!: number;

  @Index()
  @Column({ type: "timestamptz" })
  next_run_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  last_started_at?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  last_completed_at?: Date | null;

  @Column({ type: "integer", default: 0 })
  consecutive_failures!: number;

  @Column({ type: "varchar", length: 500, nullable: true })
  last_error?: string | null;
}
