import { describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { ProductDemoLead } from "../entities/product-demo-lead.entity";
import { SchemaMaintenanceService } from "../services/schema-maintenance.service";

describe("product demo lead schema maintenance", () => {
  it("registers the tenant-independent entity in the application data source", () => {
    expect(AppDataSource.options.entities).toContain(ProductDemoLead);
    expect(ProductDemoLead.prototype).not.toHaveProperty("tenant_id");
  });

  it("creates the table and idempotently backfills eligible audit records", async () => {
    const query = vi.fn().mockResolvedValue([]);

    await SchemaMaintenanceService.ensureRuntimeColumns({ query } as never);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    const createTable = statements.find((sql) => sql.includes("CREATE TABLE IF NOT EXISTS product_demo_leads"));
    const uniqueIndex = statements.find((sql) => sql.includes("UQ_product_demo_leads_source_audit_log_id"));
    const backfill = statements.find((sql) => sql.includes("INSERT INTO product_demo_leads"));
    const scrub = statements.find((sql) => sql.includes("UPDATE audit_logs audit") && sql.includes("product_demo_leads lead"));
    const submitNormalization = statements.find((sql) => sql.includes("PII_SCRUBBED_NOT_MIGRATED"));
    const emailScrub = statements.find((sql) => sql.includes("PRODUCT_SITE_DEMO_LEAD_EMAIL"));
    const passwordResetTable = statements.find((sql) => sql.includes("CREATE TABLE IF NOT EXISTS password_reset_tokens"));
    const accountAuthVersion = statements.find((sql) => sql.includes("ADD COLUMN IF NOT EXISTS auth_version"));

    expect(createTable).toContain("source_audit_log_id uuid");
    expect(createTable).not.toContain("tenant_id");
    expect(uniqueIndex).toContain("WHERE source_audit_log_id IS NOT NULL");
    expect(backfill).toContain("audit.event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT'");
    expect(backfill).toContain("audit.deleted_at IS NULL");
    expect(backfill).toContain("ON CONFLICT (source_audit_log_id)");
    expect(backfill).toContain("DO NOTHING");
    expect(scrub).toContain("lead.source_audit_log_id = audit.id");
    expect(scrub).toContain("- 'email'");
    expect(scrub).toContain("- 'phone'");
    expect(scrub).toContain("- 'note'");
    expect(scrub).toContain("'demo_lead_id', lead.id::text");
    expect(scrub).toContain("target_id = COALESCE(audit.target_id, lead.id::text)");
    expect(submitNormalization).toContain("WHERE event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT'");
    expect(submitNormalization).toContain("jsonb_strip_nulls(jsonb_build_object");
    expect(submitNormalization).not.toContain("deleted_at IS NULL");
    expect(emailScrub).toContain("jsonb_strip_nulls(jsonb_build_object");
    expect(emailScrub).toContain("jsonb_array_length(metadata -> 'errors')");
    expect(emailScrub).toContain("jsonb_typeof(metadata -> 'errors_count') = 'number'");
    expect(emailScrub).toContain("(metadata ->> 'errors_count')::integer");
    expect(accountAuthVersion).toContain("DEFAULT 1");
    expect(passwordResetTable).toContain("account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE");
    expect(passwordResetTable).toContain("token_hash varchar(64) NOT NULL");
  });
});
