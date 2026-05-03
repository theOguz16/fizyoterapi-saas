// Bu TypeORM entity'si veritabanindaki salon profile.entity tablosunun uygulama modelini tanimlar.
// Kolonlar ve iliskiler backend is kurallarinin hangi veri yapisina dayandigini burada gosterir.
import { Entity, Column, Index } from "typeorm";
import { TenantScopedEntity } from "./base.entity";

@Entity("salon_profiles")
export class SalonProfile extends TenantScopedEntity {
  @Index()
  @Column({ type: "varchar", length: 80 })
  slug!: string; // tenant slug ile aynı tutulabilir

  @Column({ type: "varchar", length: 140, nullable: true })
  hero_title?: string;

  @Column({ type: "varchar", length: 240, nullable: true })
  hero_subtitle?: string;

  @Column({ type: "varchar", length: 240, nullable: true })
  hero_image_url?: string;

  @Column({ type: "text", nullable: true })
  about_text?: string;

  @Column({ type: "jsonb", default: [] })
  why_us!: Array<{ title: string; desc?: string }>;

  @Column({ type: "jsonb", default: [] })
  services!: Array<{ title: string; desc?: string; starting_price?: string; type?: string }>;

  @Column({ type: "jsonb", default: {} })
  location!: {
    city?: string;
    district?: string;
    phone?: string;
    address?: string;
    maps_embed_url?: string;
    campaigns?: {
      referral_campaigns?: Array<{
        id?: string;
        name?: string;
        audience?: string;
        trigger_type?: string;
        required_referrals?: number;
        reward_type?: string;
        reward_value?: number;
        reward_label?: string;
        reward_target?: string;
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      loyalty_campaigns?: Array<{
        id?: string;
        name?: string;
        audience?: string;
        trigger_type?: string;
        min_lessons?: number;
        reward_type?: string;
        reward_value?: number;
        reward_label?: string;
        reward_target?: string;
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      cancellation_policy?: {
        min_hours_before_start?: number;
        refund_policy?: string;
      };
    };
    campaign_audit?: Array<{
      id?: string;
      action?: string;
      summary?: string;
      actor_id?: string | null;
      created_at?: string;
    }>;
  };

  @Column({ type: "jsonb", default: {} })
  social_links!: { instagram?: string; website?: string; whatsapp?: string };

  @Column({ type: "varchar", length: 30, default: "minimal" })
  theme!: string; // clinic/enerjik/minimal

  @Column({ type: "varchar", length: 12, default: "#111827" })
  primary_color!: string;

  @Column({
    type: "jsonb",
    default: {
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5],
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 60,
      break_duration_minutes: 0,
    },
  })
  business_hours!: {
    timezone?: string;
    working_days?: number[];
    start_time?: string;
    end_time?: string;
    lunch_break_start?: string;
    lunch_break_end?: string;
    slot_minutes?: number;
    break_duration_minutes?: number;
  };

  @Column({ type: "boolean", default: false })
  is_published!: boolean;
}
