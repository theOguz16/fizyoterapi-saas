import { AppDataSource } from "../data-source";
import { ProductDemoLead } from "../entities/product-demo-lead.entity";

const DEFAULT_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveProductDemoLeadRetentionDays(value = process.env.DEMO_LEAD_RETENTION_DAYS) {
  if (!value?.trim()) return DEFAULT_RETENTION_DAYS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.trunc(parsed)));
}

export class ProductDemoLeadRetentionService {
  /**
   * Permanently removes expired demo leads, including soft-deleted rows.
   * This deliberately uses a DELETE query instead of repository soft-delete APIs.
   */
  static async purgeExpired(now = new Date()) {
    const retentionDays = resolveProductDemoLeadRetentionDays();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const result = await AppDataSource
      .getRepository(ProductDemoLead)
      .createQueryBuilder()
      .delete()
      .from(ProductDemoLead)
      .where("created_at < :cutoff", { cutoff })
      .execute();

    return {
      cutoff,
      retentionDays,
      deleted: Number(result.affected || 0),
    };
  }
}
