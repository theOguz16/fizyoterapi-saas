// Bu servis modulu backend tarafinda member request cleanup.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { SalonApplication, SalonApplicationStatus } from "../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

function readEventPayload(event: NotificationEvent): Record<string, any> {
  try {
    const payload = event.payload;
    if (!payload) return {};
    return typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch {
    return {};
  }
}

export class MemberRequestCleanupService {
  static async cleanupStaleApplicationsForAccount(accountId: string) {
    const applications = await AppDataSource.getRepository(SalonApplication)
      .createQueryBuilder("application")
      .where("application.account_id = :accountId", { accountId })
      .andWhere(
        "(application.status = :pendingStatus OR (application.status = :approvedStatus AND application.payment_status != :verifiedStatus))",
        {
          pendingStatus: SalonApplicationStatus.PENDING,
          approvedStatus: SalonApplicationStatus.APPROVED,
          verifiedStatus: MembershipPaymentStatus.VERIFIED,
        }
      )
      .orderBy("application.created_at", "DESC")
      .getMany();

    if (applications.length === 0) return;

    const memberships = await AppDataSource.getRepository(SalonMembership).find({
      where: applications.map((row) => ({
        account_id: accountId,
        tenant_id: row.tenant_id,
        status: SalonMembershipStatus.LEFT,
      })) as any,
      order: { left_at: "DESC" },
    });
    const leftMembershipMap = new Map<string, SalonMembership>();
    for (const row of memberships) {
      if (!leftMembershipMap.has(row.tenant_id)) {
        leftMembershipMap.set(row.tenant_id, row);
      }
    }

    const staleRows = applications.filter((application) => {
      const leftMembership = leftMembershipMap.get(application.tenant_id);
      if (!leftMembership?.left_at) return false;
      return leftMembership.left_at >= application.created_at;
    });

    if (staleRows.length === 0) return;

    for (const row of staleRows) {
      row.status = SalonApplicationStatus.CANCELLED;
      row.note = "Uyelik sonlandigi icin eski basvuru otomatik iptal edildi.";
    }
    await AppDataSource.getRepository(SalonApplication).save(staleRows);
  }

  static async clearTenantScopedPendingState(params: {
    tenantId: string;
    accountId: string;
    identifiers: string[];
    reason: string;
  }) {
    const { tenantId, accountId, identifiers, reason } = params;

    await AppDataSource.getRepository(SalonApplication)
      .createQueryBuilder()
      .update(SalonApplication)
      .set({
        status: SalonApplicationStatus.CANCELLED,
        note: reason,
      })
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("account_id = :accountId", { accountId })
      .andWhere(
        "(status = :pendingStatus OR (status = :approvedStatus AND payment_status != :verifiedStatus))",
        {
          pendingStatus: SalonApplicationStatus.PENDING,
          approvedStatus: SalonApplicationStatus.APPROVED,
          verifiedStatus: MembershipPaymentStatus.VERIFIED,
        }
      )
      .execute();

    if (identifiers.length > 0) {
      const rows = await AppDataSource.getRepository(NotificationEvent).find({
        where: identifiers.flatMap((memberId) => [
          { tenant_id: tenantId, member_id: memberId, type: MEMBER_PAYMENT_REQUEST, status: NotificationEventStatus.QUEUED },
          { tenant_id: tenantId, member_id: memberId, type: MEMBER_CHANGE_REQUEST, status: NotificationEventStatus.QUEUED },
        ]) as any,
        order: { created_at: "DESC" },
      });

      for (const row of rows) {
        const payload = readEventPayload(row);
        row.status = NotificationEventStatus.PROCESSED;
        row.processed_at = new Date();
        row.payload = {
          ...payload,
          decision: "CANCELLED",
          status: "CANCELLED",
          cancel_reason: reason,
        };
      }
      if (rows.length > 0) {
        await AppDataSource.getRepository(NotificationEvent).save(rows);
      }
    }
  }

  static async findActionablePaymentRequest(params: {
    identifiers: string[];
    tenantId?: string;
    packageId?: string;
    packageIds?: string[];
  }) {
    const { identifiers, tenantId, packageId, packageIds } = params;
    if (identifiers.length === 0) return null;
    const requestedPackageIds = new Set(
      [packageId, ...(Array.isArray(packageIds) ? packageIds : [])]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    );

    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: identifiers.map((memberId) => ({
        member_id: memberId,
        tenant_id: tenantId,
        type: MEMBER_PAYMENT_REQUEST,
        status: NotificationEventStatus.QUEUED,
      })) as any,
      order: { created_at: "DESC" },
    });

    for (const row of rows) {
      const payload = readEventPayload(row);
      const payloadPackageId = typeof payload.package_id === "string" ? payload.package_id : null;
      const payloadPackageIds = Array.isArray(payload.package_ids) ? payload.package_ids.map((item: unknown) => String(item || "")) : [];
      const queuedPackageIds = new Set([payloadPackageId, ...payloadPackageIds].filter(Boolean) as string[]);
      const hasRequestedPackageOverlap =
        requestedPackageIds.size === 0 || Array.from(requestedPackageIds).some((queuedId) => queuedPackageIds.has(queuedId));

      if (!hasRequestedPackageOverlap) {
        continue;
      }
      const applicationId = typeof payload.application_id === "string" ? payload.application_id : null;
      if (!applicationId) {
        return row;
      }
      const application = await AppDataSource.getRepository(SalonApplication).findOne({
        where: tenantId ? { id: applicationId, tenant_id: tenantId } : { id: applicationId },
      });
      const actionable = Boolean(
        application &&
          (application.status === SalonApplicationStatus.PENDING ||
            (application.status === SalonApplicationStatus.APPROVED && application.payment_status !== MembershipPaymentStatus.VERIFIED))
      );
      if (actionable) {
        return row;
      }
      row.status = NotificationEventStatus.PROCESSED;
      row.processed_at = new Date();
      row.payload = {
        ...payload,
        decision: "CANCELLED",
        status: "CANCELLED",
        cancel_reason: "STALE_PENDING_REQUEST",
      };
      await AppDataSource.getRepository(NotificationEvent).save(row);
    }

    return null;
  }
}
