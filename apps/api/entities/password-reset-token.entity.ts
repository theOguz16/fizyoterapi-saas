import { Column, Entity, Index } from "typeorm";
import { BaseEntityWithTimestamps } from "./base.entity";

@Entity("password_reset_tokens")
export class PasswordResetToken extends BaseEntityWithTimestamps {
  @Index()
  @Column({ type: "uuid" })
  account_id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 64 })
  token_hash!: string;

  @Index()
  @Column({ type: "timestamptz" })
  expires_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  used_at?: Date | null;
}
