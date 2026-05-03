// Bu controller admin tarafindaki mobile approvals.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { Account } from "../../entities/account.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { ClassSession, SessionStatus } from "../../entities/class-session.entity";
import { MembershipPaymentStatus } from "../../entities/salon-membership.entity";
import { AdminSalonApplicationsController } from "./salon-applications.controller";
import { AuditLogService } from "../../services/audit-log.service";
import { User } from "../../entities/user.entity";
import { MobilePurchaseSyncService } from "../../services/mobile-purchase-sync.service";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

export class AdminMobileApprovalsController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const [applications, events] = await Promise.all([
      AppDataSource.getRepository(SalonApplication).find({
        where: { tenant_id: tenantId, status: SalonApplicationStatus.PENDING },
        order: { created_at: "DESC" },
      }),
      AppDataSource.getRepository(NotificationEvent).find({
        where: { tenant_id: tenantId, status: NotificationEventStatus.QUEUED } as any,
        order: { created_at: "DESC" },
      }),
    ]);

    const accountIds = Array.from(
      new Set([
        ...applications.map((row) => row.account_id),
        ...events.map((row) => String(row.payload?.account_id || row.member_id)).filter(Boolean),
      ])
    );
    const accounts = accountIds.length ? await AppDataSource.getRepository(Account).find({ where: accountIds.map((id) => ({ id })) as any }) : [];
    const accountMap = new Map(accounts.map((row) => [row.id, row]));

    const appRows = applications.map((row) => {
      const account = accountMap.get(row.account_id);
      const parsedNote = parseApplicationNote(row.note);
      const memberName = account ? `${account.first_name} ${account.last_name}`.trim() : "Yeni başvuru";
      return {
        id: `application:${row.id}`,
        type: "APPLICATION",
        title: memberName,
        subtitle: parsedNote.note || account?.email || "Salon başvurusu onay bekliyor.",
        status: row.status,
        created_at: row.created_at,
        amount: null,
        member_name: memberName,
        member_email: account?.email || null,
        note: parsedNote.note,
        request_type: "APPLICATION",
        submitted_at: row.created_at,
      };
    });

    const eventRows = events
      .filter((row) => row.type === MEMBER_PAYMENT_REQUEST || row.type === MEMBER_CHANGE_REQUEST)
      .map((row) => {
        const memberAccount = accountMap.get(String(row.payload?.account_id || row.member_id || ""));
        const memberName = memberAccount
          ? `${memberAccount.first_name} ${memberAccount.last_name}`.trim()
          : String(row.payload?.member_name || "Üye");
        const type = row.type === MEMBER_PAYMENT_REQUEST ? "PAYMENT" : "CHANGE_REQUEST";
        const requestType = String(row.payload?.request_type || "");
        const firstSelectedDay = Array.isArray(row.payload?.selected_days) ? row.payload.selected_days[0] as Record<string, unknown> | undefined : undefined;
        const isGroupClass = Boolean(firstSelectedDay?.is_group_class) || requestType.toUpperCase() === "GROUP_CLASS_JOIN";
        const lessonName =
          typeof firstSelectedDay?.lesson_name === "string" && firstSelectedDay.lesson_name.trim()
            ? firstSelectedDay.lesson_name.trim()
            : typeof row.payload?.selected_sub_lesson === "string"
              ? row.payload.selected_sub_lesson
              : null;
        return {
          id: `${row.type === MEMBER_PAYMENT_REQUEST ? "payment" : "change"}:${row.id}`,
          type,
          title:
            type === "PAYMENT"
              ? isGroupClass
                ? `${lessonName || "Grup dersi"} katılımı`
                : `${resolvePaymentTitle(row.payload)} onayı`
              : humanizeChangeRequestType(requestType),
          subtitle:
            type === "PAYMENT"
              ? `${memberName} için ödeme doğrulaması bekleniyor. ${resolvePaymentSubtitle(row.payload)}`
              : String(row.payload?.note || "Üye planında güncelleme talebi var."),
          status: "PENDING",
          created_at: row.created_at,
          amount: typeof row.payload?.amount === "number" ? row.payload.amount : null,
          member_name: memberName,
          member_email: memberAccount?.email || null,
          note: typeof row.payload?.note === "string" ? row.payload.note : null,
          request_type: requestType || type,
          request_scope: typeof row.payload?.request_scope === "string" ? row.payload.request_scope : null,
          active_membership_id: typeof row.payload?.active_membership_id === "string" ? row.payload.active_membership_id : null,
          submitted_at: typeof row.payload?.submitted_at === "string" ? row.payload.submitted_at : row.created_at,
          is_group_class: isGroupClass,
          lesson_name: lessonName,
          recurrence_label: typeof firstSelectedDay?.recurrence_label === "string" ? firstSelectedDay.recurrence_label : null,
          special_date: typeof firstSelectedDay?.special_date === "string" ? firstSelectedDay.special_date : null,
          requested_price: typeof firstSelectedDay?.price === "number" || typeof firstSelectedDay?.price === "string" ? firstSelectedDay.price : row.payload?.requested_price ?? row.payload?.amount ?? null,
          notification_scope: typeof firstSelectedDay?.notification_scope === "string" ? firstSelectedDay.notification_scope : row.payload?.notification_scope ?? null,
          invited_member_count: typeof row.payload?.invited_member_count === "number" ? row.payload.invited_member_count : 0,
          joined_member_count:
            typeof row.payload?.joined_member_count === "number"
              ? row.payload.joined_member_count
              : typeof firstSelectedDay?.joined_count === "number"
                ? firstSelectedDay.joined_count
                : 0,
        };
      });

    return res.json({ data: [...eventRows, ...appRows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)) });
  }

  static async decide(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const adminId = req.auth?.linkedUserId || req.auth?.sub || null;
    const rawId = String(req.params.id || "");
    const decision = String(req.body?.decision || "").toUpperCase() === "REJECT" ? "REJECT" : "APPROVE";
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const [kind, entityId] = rawId.split(":");
    if (!kind || !entityId) throw new AppError("VALIDATION_ERROR", 422, "Geçersiz approval kimliği");

    if (kind === "application") {
      const repo = AppDataSource.getRepository(SalonApplication);
      const application = await repo.findOne({ where: { id: entityId, tenant_id: tenantId } });
      if (!application) throw new AppError("APPLICATION_NOT_FOUND", 404, "Başvuru bulunamadı");
      application.status = decision === "APPROVE" ? SalonApplicationStatus.APPROVED : SalonApplicationStatus.REJECTED;
      if (decision === "APPROVE") {
        application.payment_status = MembershipPaymentStatus.UNPAID;
        application.note = application.note || "Mobil onay kuyruğundan onaylandı.";
      }
      await repo.save(application);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MOBILE_APPLICATION_DECIDED",
        action: "ADMIN_MOBILE_APPLICATION_DECIDED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "salon_application",
        target_id: application.id,
        metadata: { decision, status: application.status },
      });
      return res.json({ data: { id: rawId, type: "APPLICATION", status: decision === "APPROVE" ? "APPROVED" : "REJECTED" } });
    }

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const event = await eventRepo.findOne({ where: { id: entityId, tenant_id: tenantId } });
    if (!event) throw new AppError("APPROVAL_NOT_FOUND", 404, "Onay kaydı bulunamadı");

    if (kind === "payment" && event.type === MEMBER_PAYMENT_REQUEST) {
      const applicationId = String(event.payload?.application_id || "");
      const applicationRepo = AppDataSource.getRepository(SalonApplication);
      const application = applicationId ? await applicationRepo.findOne({ where: { id: applicationId, tenant_id: tenantId } }) : null;
      const accountId = String(event.payload?.account_id || "");
      const activeMembership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: accountId
          ? ({ tenant_id: tenantId, account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true } as any)
          : undefined,
      });

      if (decision === "APPROVE") {
        if (activeMembership?.user_id) {
          const memberUser = await AppDataSource.getRepository(User).findOne({
            where: { tenant_id: tenantId, id: activeMembership.user_id },
          });
          if (!memberUser) {
            throw new AppError("MEMBER_NOT_FOUND", 404, "Üye kaydı bulunamadı");
          }
          await MobilePurchaseSyncService.applyApprovedPurchaseContext({
            tenantId,
            memberUser,
            context: MobilePurchaseSyncService.normalizePurchaseContext(event.payload),
            requestId: event.id,
          });
          if (application) {
            application.status = SalonApplicationStatus.APPROVED;
            application.payment_status = MembershipPaymentStatus.VERIFIED;
            application.payment_confirmed_at = new Date();
            application.payment_reference = application.payment_reference || `mobile-${Date.now()}`;
            await applicationRepo.save(application);
          }
          event.payload = { ...event.payload, decision: "APPROVED", status: "APPROVED", membership_id: activeMembership.id };
        } else if (application) {
          if (application.status !== SalonApplicationStatus.APPROVED) {
            application.status = SalonApplicationStatus.APPROVED;
            application.payment_status = MembershipPaymentStatus.UNPAID;
          }
          application.note = JSON.stringify(event.payload);
          await applicationRepo.save(application);
          const result = await AdminSalonApplicationsController.activateMembershipForApplication({
            tenantId,
            approverId: adminId,
            application,
          });
          application.payment_status = MembershipPaymentStatus.VERIFIED;
          application.payment_confirmed_at = new Date();
          application.payment_reference = application.payment_reference || `mobile-${Date.now()}`;
          await applicationRepo.save(application);
          event.payload = { ...event.payload, decision: "APPROVED", status: "APPROVED", membership_id: result.membership.id };
        } else {
          const memberUserId = String(event.payload?.member_user_id || "");
          const membership = await AppDataSource.getRepository(SalonMembership).findOne({
            where: [
              { tenant_id: tenantId, user_id: memberUserId, status: SalonMembershipStatus.ACTIVE, is_active_context: true },
              { tenant_id: tenantId, account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true },
            ] as any,
          });
          if (!membership?.user_id) {
            throw new AppError("MEMBERSHIP_NOT_FOUND", 404, "Aktif üyelik bulunamadı");
          }
          const memberUser = await AppDataSource.getRepository(User).findOne({
            where: { tenant_id: tenantId, id: membership.user_id },
          });
          if (!memberUser) {
            throw new AppError("MEMBER_NOT_FOUND", 404, "Üye kaydı bulunamadı");
          }
          await MobilePurchaseSyncService.applyApprovedPurchaseContext({
            tenantId,
            memberUser,
            context: MobilePurchaseSyncService.normalizePurchaseContext(event.payload),
            requestId: event.id,
          });
          event.payload = { ...event.payload, decision: "APPROVED", status: "APPROVED", membership_id: membership.id };
        }
        event.status = NotificationEventStatus.PROCESSED;
        event.processed_at = new Date();
        event.triggered_by_admin_id = adminId || undefined;
      } else {
        event.status = NotificationEventStatus.PROCESSED;
        event.processed_at = new Date();
        event.triggered_by_admin_id = adminId || undefined;
        event.payload = { ...event.payload, decision: "REJECTED", status: "REJECTED" };
      }

      await eventRepo.save(event);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MOBILE_PAYMENT_DECIDED",
        action: "ADMIN_MOBILE_PAYMENT_DECIDED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "notification_event",
        target_id: event.id,
        metadata: { decision, status: String(event.payload.status), application_id: application?.id || null },
      });
      return res.json({ data: { id: rawId, type: "PAYMENT", status: String(event.payload.status) } });
    }

    if (kind === "change" && event.type === MEMBER_CHANGE_REQUEST) {

      const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : (event.payload || {});
      
    // =====================================================================
      // 🎯 GRUP DERSİ ONAY MANTIĞI (CREATE, UPDATE VE CANCEL İÇİN)
      // =====================================================================
      if ((payload.request_type === "GROUP_CLASS_CREATE" || payload.request_type === "GROUP_CLASS_UPDATE" || payload.request_type === "GROUP_CLASS_CANCEL") && payload.session_id) {
        
        const sessionRepo = AppDataSource.getRepository(ClassSession);
        const session = await sessionRepo.findOne({ where: { id: payload.session_id, tenant_id: tenantId } });

        if (session) {
          if (payload.request_type === "GROUP_CLASS_CANCEL") {
            // İPTAL TALEBİ İSE:
            if (decision === "APPROVE") {
              session.status = SessionStatus.CANCELED; // İptal onaylandı, ders çöpe gitti
            } else {
              session.status = SessionStatus.SCHEDULED; // İptal reddedildi, takvime zorla geri kondu
            }
          } else {
            // OLUŞTURMA VE GÜNCELLEME TALEBİ İSE:
            if (decision === "APPROVE") {
              session.status = SessionStatus.SCHEDULED; // Onaylandı, takvime düştü
            } else {
              session.status = SessionStatus.CANCELED; // Reddedildi
            }
          }
          await sessionRepo.save(session);
        }
      }

      event.status = NotificationEventStatus.PROCESSED;
      event.processed_at = new Date();
      event.triggered_by_admin_id = adminId || undefined;
      event.payload = {
        ...event.payload,
        decision: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
      };
      await eventRepo.save(event);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MOBILE_CHANGE_REQUEST_DECIDED",
        action: "ADMIN_MOBILE_CHANGE_REQUEST_DECIDED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "notification_event",
        target_id: event.id,
        metadata: { decision, status: String(event.payload.status), request_type: String(event.payload?.request_type || "") },
      });
      return res.json({ data: { id: rawId, type: "CHANGE_REQUEST", status: String(event.payload.status) } });
    }

    throw new AppError("APPROVAL_NOT_FOUND", 404, "Bu kayıt mobil onay kuyruğunda desteklenmiyor");
  }
}

function resolvePaymentTitle(payload: any) {
  const selectedPackages = Array.isArray(payload?.selected_packages) ? payload.selected_packages : [];
  if (selectedPackages.length > 1) {
    return `${selectedPackages.length} paket`;
  }
  return String(payload?.package_title || selectedPackages[0]?.package_title || "Ödeme talebi");
}

function resolvePaymentSubtitle(payload: any) {
  const selectedPackages = Array.isArray(payload?.selected_packages) ? payload.selected_packages : [];
  if (selectedPackages.length > 1) {
    return `Seçim: ${selectedPackages.map((item: any) => item?.package_title || item?.package_id).filter(Boolean).join(", ")}.`;
  }
  return "";
}

function parseApplicationNote(note?: string | null) {
  if (!note) return { note: null as string | null };
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === "object") {
      return {
        note: typeof parsed.note === "string" ? parsed.note : null,
      };
    }
  } catch {
    return { note };
  }
  return { note: null };
}

function humanizeChangeRequestType(value: string) {
  switch (value) {
    case "PACKAGE_RENEWAL":
      return "Paket yenileme talebi";
    case "PACKAGE_CANCEL":
      return "Paket iptal talebi";
    case "TRAINER_CHANGE":
      return "Eğitmen değişikliği talebi";
    default:
      return "Değişiklik talebi";
  }
}
