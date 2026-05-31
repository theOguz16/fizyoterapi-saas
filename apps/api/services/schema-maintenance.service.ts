// Runtime schema guard'lari migration altyapisi olmayan kurulumlarda geriye uyumlu kolon eklemeleri yapar.
// Sadece idempotent ve veri kaybina yol acmayan islemler burada tutulmali.
import { DataSource } from "typeorm";

export class SchemaMaintenanceService {
  static async ensureRuntimeColumns(dataSource: DataSource) {
    await dataSource.query(`
      ALTER TABLE IF EXISTS referrals
      ADD COLUMN IF NOT EXISTS invitee_name varchar(120)
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'salon_profiles_managed_growth_status_enum'
        ) THEN
          CREATE TYPE salon_profiles_managed_growth_status_enum AS ENUM (
            'PREPARING',
            'WAITING_INFO',
            'LIVE',
            'OPTIMIZING'
          );
        END IF;
      END $$;
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS salon_profiles
      ADD COLUMN IF NOT EXISTS seo_title varchar(160),
      ADD COLUMN IF NOT EXISTS seo_description varchar(240),
      ADD COLUMN IF NOT EXISTS google_business_url varchar(260),
      ADD COLUMN IF NOT EXISTS google_maps_url varchar(260),
      ADD COLUMN IF NOT EXISTS business_category varchar(100),
      ADD COLUMN IF NOT EXISTS service_area jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS digital_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS managed_growth_status salon_profiles_managed_growth_status_enum NOT NULL DEFAULT 'PREPARING'
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_salon_profiles_managed_growth_status"
      ON salon_profiles (managed_growth_status)
    `);

    await dataSource.query(`
      DO $$
      DECLARE
        idx record;
        con record;
      BEGIN
        FOR con IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = current_schema()
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) ILIKE '%(email)%'
        LOOP
          EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', con.conname);
        END LOOP;

        FOR idx IN
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'users'
            AND indexdef ILIKE '%UNIQUE%'
            AND indexdef ILIKE '%(email)%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
        END LOOP;
      END $$;
    `);

    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_tenant_email_role"
      ON users (tenant_id, email, role)
      WHERE deleted_at IS NULL
    `);

    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_tenant_qr_code"
      ON users (tenant_id, qr_code)
      WHERE qr_code IS NOT NULL AND deleted_at IS NULL
    `);
  }
}
