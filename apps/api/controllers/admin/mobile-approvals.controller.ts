// Bu controller admin tarafindaki mobile approvals.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
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
import { GroupClassCancellationService } from "../../services/group-class-cancellation.service";
import { Invite, InviteStatus } from "../../entities/invite.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../../entities/booking.entity";
import { MobileNotificationService } from "../../services/mobile-notification.service";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

export class AdminMobileApprovalsController {
  private static async safeQueuePush(input: Parameters<typeof MobileNotificationService.queuePush>[0]) {
    try {
      await MobileNotificationService.queuePush(input);
    } catch (error) {
      console.error("Duo push notification error:", error);
    }
  }

  private static generateInviteToken() {
    return crypto.randomBytes(24).toString("base64url");
  }

  private static hashInviteToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private static normalizeInviteIdentity(raw: unknown) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value) return "";
    return value.includes("@") ? value : value.replace(/\D/g, "");
  }

  private static readEventPayload(event: NotificationEvent): Record<string, any> {
    try {
      const payload = event.payload;
      if (!payload) return {};
      return typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch {
      return {};
    }
  }

  private static async createDuoPartnerInviteIfNeeded(params: {
    tenantId: string;
    adminId: string | null;
    event: NotificationEvent;
    primaryMemberUserId: string;
  }) {
    const payload = AdminMobileApprovalsController.readEventPayload(params.event);
    if (
      String(payload.lesson_mode || "").toUpperCase() !== "DUO" ||
      String(payload.request_type || "").toUpperCase() === "DUO_PARTNER_PAYMENT" ||
      payload.duo_invite_token
    ) {
      return;
    }
    const partnerIdentity = AdminMobileApprovalsController.normalizeInviteIdentity(payload.duo_partner_contact);
    if (!partnerIdentity) return;

    const token = AdminMobileApprovalsController.generateInviteToken();
    const invite = AppDataSource.getRepository(Invite).create({
      tenant_id: params.tenantId,
      role: "MEMBER" as any,
      email_or_phone: partnerIdentity,
      token_hash: AdminMobileApprovalsController.hashInviteToken(token),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: InviteStatus.PENDING,
      invited_by_admin_id: params.adminId || params.primaryMemberUserId,
      meta: {
        kind: "DUO_PARTNER",
        primary_payment_event_id: params.event.id,
        primary_member_user_id: params.primaryMemberUserId,
        primary_account_id: payload.account_id || null,
        tenant_slug: payload.tenant_slug || null,
        tenant_name: payload.tenant_name || null,
        package_id: payload.package_id || null,
        package_ids: payload.package_ids || [],
        package_title: payload.package_title || null,
        selected_packages: payload.selected_packages || [],
        amount:
          payload.duo_payment && typeof payload.duo_payment === "object"
            ? (payload.duo_payment as Record<string, unknown>).partner_amount ?? payload.amount ?? null
            : payload.amount ?? null,
        total_package_amount: payload.total_package_amount ?? null,
        trainer_id: payload.trainer_id || null,
        selected_sub_lesson: payload.selected_sub_lesson || null,
        selected_days: payload.selected_days || [],
        duo_partner_name: payload.duo_partner_name || null,
        duo_partner_contact: partnerIdentity,
      },
    });
    await AppDataSource.getRepository(Invite).save(invite);

    const appUrl = process.env.MOBILE_DEEP_LINK_BASE || process.env.ADMIN_WEB_URL || process.env.WEB_URL || "http://localhost:2929";
    const inviteUrl = `${appUrl.replace(/\/$/, "")}/invite/accept?token=${token}`;
    params.event.payload = {
      ...payload,
      duo_invite_id: invite.id,
      duo_invite_token: token,
      duo_invite_url: inviteUrl,
      duo_payment: {
        ...(typeof payload.duo_payment === "object" && payload.duo_payment ? payload.duo_payment : {}),
        status: "INVITE_SENT",
      },
    };

    const packageTitle = String(payload.package_title || "Duo paket");
    await AdminMobileApprovalsController.safeQueuePush({
      tenantId: params.tenantId,
      userId: params.primaryMemberUserId,
      roleScope: "MEMBER",
      type: "DUO_INVITE_SENT",
      title: "Duo partner daveti hazır",
      body: `${packageTitle} için partner daveti oluşturuldu. Partner kalan %50 payı tamamlayınca paket aktifleşir.`,
      deepLink: "fizyoflow://member/package",
      meta: {
        invite_id: invite.id,
        payment_event_id: params.event.id,
        package_id: payload.package_id || null,
        partner_contact: partnerIdentity,
      },
    });

    const partnerUser = partnerIdentity.includes("@")
      ? await AppDataSource.getRepository(User).findOne({ where: { tenant_id: params.tenantId, email: partnerIdentity } })
      : await AppDataSource.getRepository(User).findOne({ where: { tenant_id: params.tenantId, phone: partnerIdentity } as any });
    if (partnerUser?.id) {
      await AdminMobileApprovalsController.safeQueuePush({
        tenantId: params.tenantId,
        userId: partnerUser.id,
        roleScope: "MEMBER",
        type: "DUO_PARTNER_INVITED",
        title: "Duo ders davetin var",
        body: `${packageTitle} için partner olarak davet edildin. Daveti kabul edip kendi %50 payını onaya gönderebilirsin.`,
        deepLink: `fizyoflow://(auth)/invite-accept?token=${encodeURIComponent(token)}`,
        meta: {
          invite_id: invite.id,
          primary_payment_event_id: params.event.id,
          package_id: payload.package_id || null,
        },
      });
    }
  }

  private static async finalizeDuoPartnerPayment(params: { tenantId: string; payload: Record<string, any> }) {
    const primaryEventId = String(params.payload.duo_primary_payment_event_id || "");
    const partnerUserId = String(params.payload.member_user_id || "");
    if (!primaryEventId || !partnerUserId) return;

    const [primaryEvent, partnerUser] = await Promise.all([
      AppDataSource.getRepository(NotificationEvent).findOne({ where: { id: primaryEventId, tenant_id: params.tenantId } }),
      AppDataSource.getRepository(User).findOne({ where: { id: partnerUserId, tenant_id: params.tenantId } }),
    ]);
    if (!primaryEvent || !partnerUser) return;

    const primaryPayload = primaryEvent.payload || {};
    const primaryMemberUserId = String(primaryPayload.member_user_id || "");
    const packageIds = Array.isArray(primaryPayload.package_ids)
      ? primaryPayload.package_ids.map((item: unknown) => String(item || "")).filter(Boolean)
      : [String(primaryPayload.package_id || "")].filter(Boolean);
    if (!primaryMemberUserId || packageIds.length === 0) return;

    const userPackageRepo = AppDataSource.getRepository(UserPackage);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const primarySourceRequestIds = Array.from(
      new Set([primaryEventId, String(primaryPayload.application_id || "")].filter(Boolean))
    );
    const primaryPackages = primarySourceRequestIds.length
      ? await userPackageRepo
          .createQueryBuilder("up")
          .where("up.tenant_id = :tenantId", { tenantId: params.tenantId })
          .andWhere("up.user_id = :userId", { userId: primaryMemberUserId })
          .andWhere("up.package_id IN (:...packageIds)", { packageIds })
          .andWhere("up.source_request_id IN (:...sourceRequestIds)", { sourceRequestIds: primarySourceRequestIds })
          .getMany()
      : [];
    for (const row of primaryPackages) {
      row.is_active = true;
      row.package_snapshot = {
        ...(row.package_snapshot || {}),
        duo: {
          ...((row.package_snapshot as Record<string, any> | undefined)?.duo || {}),
          status: "ACTIVE",
          partner_user_id: partnerUserId,
          payment: {
            ...((row.package_snapshot as Record<string, any> | undefined)?.duo?.payment || {}),
            status: "PAID",
            partner_paid_at: new Date().toISOString(),
          },
        },
      };
      await userPackageRepo.save(row);
    }

    const partnerPackages = await userPackageRepo
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId: params.tenantId })
      .andWhere("up.user_id = :userId", { userId: partnerUserId })
      .andWhere("up.package_id IN (:...packageIds)", { packageIds })
      .andWhere("up.source_request_id = :sourceRequestId", { sourceRequestId: params.payload.duo_partner_payment_event_id || "" })
      .getMany();
    for (const row of partnerPackages) {
      row.is_active = true;
      row.package_snapshot = {
        ...(row.package_snapshot || {}),
        duo: {
          ...((row.package_snapshot as Record<string, any> | undefined)?.duo || {}),
          status: "ACTIVE",
          primary_member_user_id: primaryMemberUserId,
          partner_user_id: partnerUserId,
          payment: {
            ...((row.package_snapshot as Record<string, any> | undefined)?.duo?.payment || {}),
            status: "PAID",
            partner_paid_at: new Date().toISOString(),
          },
        },
      };
      await userPackageRepo.save(row);
    }

    const primaryBookings = await bookingRepo.find({
      where: { tenant_id: params.tenantId, member_id: primaryMemberUserId } as any,
      order: { starts_at: "ASC" },
    });
    const matchedPrimaryBookings = primaryBookings.filter((booking) => {
      const meta = booking.meta || {};
      return primarySourceRequestIds.includes(String(meta.request_id || "")) && Boolean(meta.is_duo);
    });

    for (const booking of matchedPrimaryBookings) {
      booking.status = BookingStatus.APPROVED;
      booking.payment_status = BookingPaymentStatus.APPROVED;
      booking.payment_approved_at = booking.payment_approved_at || new Date();
      booking.meta = {
        ...(booking.meta || {}),
        duo: {
          ...((booking.meta as Record<string, any>).duo || {}),
          status: "ACTIVE",
          partner_user_id: partnerUserId,
        },
      };
      await bookingRepo.save(booking);

      const existingPartnerBooking = await bookingRepo.findOne({
        where: {
          tenant_id: params.tenantId,
          member_id: partnerUserId,
          trainer_id: booking.trainer_id,
          starts_at: booking.starts_at,
          ends_at: booking.ends_at,
        } as any,
      });
      if (!existingPartnerBooking) {
        await bookingRepo.save(
          bookingRepo.create({
            tenant_id: params.tenantId,
            member_id: partnerUserId,
            trainer_id: booking.trainer_id,
            session_id: booking.session_id,
            starts_at: booking.starts_at,
            ends_at: booking.ends_at,
            status: BookingStatus.APPROVED,
            payment_status: BookingPaymentStatus.APPROVED,
            payment_approved_at: new Date(),
            meta: {
              ...(booking.meta || {}),
              source: "DUO_PARTNER_PAYMENT_APPROVAL",
              request_id: params.payload.duo_partner_payment_event_id || null,
              primary_booking_id: booking.id,
              primary_member_user_id: primaryMemberUserId,
              is_duo: true,
              duo: {
                ...((booking.meta as Record<string, any>).duo || {}),
                status: "ACTIVE",
                primary_member_user_id: primaryMemberUserId,
                partner_user_id: partnerUserId,
              },
            },
          })
        );
      }
    }

    const packageTitle = String(primaryPayload.package_title || params.payload.package_title || "Duo paket");
    const trainerIds = Array.from(new Set(matchedPrimaryBookings.map((booking) => booking.trainer_id).filter(Boolean)));
    await Promise.all([
      AdminMobileApprovalsController.safeQueuePush({
        tenantId: params.tenantId,
        userId: primaryMemberUserId,
        roleScope: "MEMBER",
        type: "DUO_PACKAGE_ACTIVATED",
        title: "Duo paketin aktif",
        body: `${packageTitle} için partner ödemesi onaylandı. İkili ders takvimin aktifleşti.`,
        deepLink: "fizyoflow://member/calendar",
        meta: {
          primary_payment_event_id: primaryEventId,
          partner_user_id: partnerUserId,
          package_ids: packageIds,
        },
      }),
      AdminMobileApprovalsController.safeQueuePush({
        tenantId: params.tenantId,
        userId: partnerUserId,
        roleScope: "MEMBER",
        type: "DUO_PACKAGE_ACTIVATED",
        title: "Duo paketin aktif",
        body: `${packageTitle} için ödeme onaylandı. İkili ders takvimin aktifleşti.`,
        deepLink: "fizyoflow://member/calendar",
        meta: {
          primary_payment_event_id: primaryEventId,
          partner_payment_event_id: params.payload.duo_partner_payment_event_id || null,
          package_ids: packageIds,
        },
      }),
      ...trainerIds.map((trainerId) =>
        AdminMobileApprovalsController.safeQueuePush({
          tenantId: params.tenantId,
          userId: String(trainerId),
          roleScope: "TRAINER",
          type: "DUO_BOOKING_ACTIVATED",
          title: "Duo ders takvimine eklendi",
          body: `${packageTitle} için iki kişilik ders onaylandı.`,
          deepLink: "fizyoflow://trainer/calendar",
          meta: {
            primary_member_user_id: primaryMemberUserId,
            partner_user_id: partnerUserId,
            package_ids: packageIds,
          },
        })
      ),
    ]);
  }

  private static async attachDuoInviteToPrimaryRecords(params: {
    tenantId: string;
    primaryMemberUserId: string;
    sourceRequestIds: string[];
    payload: Record<string, any>;
  }) {
    if (!params.payload.duo_invite_url) return;
    const sourceRequestIds = params.sourceRequestIds.filter(Boolean);
    if (!sourceRequestIds.length) return;

    const userPackages = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId: params.tenantId })
      .andWhere("up.user_id = :userId", { userId: params.primaryMemberUserId })
      .andWhere("up.source_request_id IN (:...sourceRequestIds)", { sourceRequestIds })
      .getMany();
    for (const row of userPackages) {
      const snapshot = row.package_snapshot || {};
      const duo = (snapshot as Record<string, any>).duo || {};
      row.package_snapshot = {
        ...snapshot,
        duo: {
          ...duo,
          invite_url: params.payload.duo_invite_url,
          invite_token: params.payload.duo_invite_token || null,
          status: duo.status || "AWAITING_PARTNER_PAYMENT",
          payment: {
            ...(duo.payment || {}),
            status: "INVITE_SENT",
          },
        },
      };
      await AppDataSource.getRepository(UserPackage).save(row);
    }
  }

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
        ...events.map((row) => String(AdminMobileApprovalsController.readEventPayload(row).account_id || row.member_id)).filter(Boolean),
      ])
    );

    const accounts = accountIds.length
      ? await AppDataSource.getRepository(Account).find({
          where: accountIds.map((id) => ({ id })) as any,
        })
      : [];

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
        const payload = AdminMobileApprovalsController.readEventPayload(row);
        const memberAccount = accountMap.get(String(payload.account_id || row.member_id || ""));
        const memberName = memberAccount
          ? `${memberAccount.first_name} ${memberAccount.last_name}`.trim()
          : String(payload.member_name || "Üye");

        const type = row.type === MEMBER_PAYMENT_REQUEST ? "PAYMENT" : "CHANGE_REQUEST";
        const requestType = String(payload.request_type || "");
        const firstSelectedDay = Array.isArray(payload.selected_days)
          ? (payload.selected_days[0] as Record<string, unknown> | undefined)
          : undefined;

        const isGroupClass =
          Boolean(firstSelectedDay?.is_group_class) ||
          requestType.toUpperCase() === "GROUP_CLASS_JOIN" ||
          requestType.toUpperCase() === "GROUP_CLASS_CREATE" ||
          requestType.toUpperCase() === "GROUP_CLASS_UPDATE" ||
          requestType.toUpperCase() === "GROUP_CLASS_CANCEL";
        const isDuo = String(payload.lesson_mode || "").toUpperCase() === "DUO" || Boolean(payload.duo_payment);
        const isDuoPartnerPayment = requestType.toUpperCase() === "DUO_PARTNER_PAYMENT";

        const lessonName =
          typeof firstSelectedDay?.lesson_name === "string" && firstSelectedDay.lesson_name.trim()
            ? firstSelectedDay.lesson_name.trim()
            : typeof payload.selected_sub_lesson === "string" && payload.selected_sub_lesson.trim()
              ? payload.selected_sub_lesson.trim()
              : typeof payload.lesson_name === "string" && payload.lesson_name.trim()
                ? payload.lesson_name.trim()
                : null;

        return {
          id: `${row.type === MEMBER_PAYMENT_REQUEST ? "payment" : "change"}:${row.id}`,
          type,
          title:
            type === "PAYMENT"
              ? isGroupClass
                ? `${lessonName || "Grup dersi"} katılımı`
                : isDuo
                  ? `${resolvePaymentTitle(payload)} ${isDuoPartnerPayment ? "partner ödeme onayı" : "duo ödeme onayı"}`
                : `${resolvePaymentTitle(payload)} onayı`
              : humanizeChangeRequestType(requestType),
          subtitle:
            type === "PAYMENT"
              ? isDuo
                ? `${memberName} için %50 duo ödeme doğrulaması bekleniyor. Partner: ${String(payload.duo_partner_name || "Belirtilmedi")}.`
                : `${memberName} için ödeme doğrulaması bekleniyor. ${resolvePaymentSubtitle(payload)}`
              : String(
                  payload.subtitle ||
                    payload.note ||
                    (lessonName ? `${lessonName} için admin onayı bekleniyor.` : "") ||
                    "Üye planında güncelleme talebi var."
                ),
          status: "PENDING",
          created_at: row.created_at,
          amount: typeof payload.amount === "number" ? payload.amount : null,
          member_name: memberName,
          member_email: memberAccount?.email || null,
          note: typeof payload.note === "string" ? payload.note : null,
          request_type: requestType || type,
          request_scope: typeof payload.request_scope === "string" ? payload.request_scope : null,
          active_membership_id:
            typeof payload.active_membership_id === "string" ? payload.active_membership_id : null,
          submitted_at: typeof payload.submitted_at === "string" ? payload.submitted_at : row.created_at,
          is_group_class: isGroupClass,
          lesson_name: lessonName,
          recurrence_label:
            typeof firstSelectedDay?.recurrence_label === "string"
              ? firstSelectedDay.recurrence_label
              : typeof payload.recurrence_label === "string"
                ? payload.recurrence_label
                : null,
          special_date:
            typeof firstSelectedDay?.special_date === "string"
              ? firstSelectedDay.special_date
              : typeof payload.special_date === "string"
                ? payload.special_date
                : null,
          requested_price:
            typeof firstSelectedDay?.price === "number" || typeof firstSelectedDay?.price === "string"
              ? firstSelectedDay.price
              : payload.requested_price ?? payload.amount ?? null,
          notification_scope:
            typeof firstSelectedDay?.notification_scope === "string"
              ? firstSelectedDay.notification_scope
              : payload.notification_scope ?? null,
          invited_member_count:
            typeof payload.invited_member_count === "number" ? payload.invited_member_count : 0,
          joined_member_count:
            typeof payload.joined_member_count === "number"
              ? payload.joined_member_count
              : typeof firstSelectedDay?.joined_count === "number"
                ? firstSelectedDay.joined_count
                : 0,
          is_duo: isDuo,
          duo_partner_name: typeof payload.duo_partner_name === "string" ? payload.duo_partner_name : null,
          duo_partner_contact: typeof payload.duo_partner_contact === "string" ? payload.duo_partner_contact : null,
          duo_payment_status:
            payload.duo_payment && typeof payload.duo_payment === "object"
              ? String((payload.duo_payment as Record<string, unknown>).status || "")
              : null,
          duo_payment_note:
            payload.duo_payment && typeof payload.duo_payment === "object"
              ? String((payload.duo_payment as Record<string, unknown>).note || "")
              : null,
        };
      });

    return res.json({
      data: [...eventRows, ...appRows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    });
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
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "salon_application",
        target_id: application.id,
        metadata: { decision, status: application.status },
      });

      return res.json({
        data: {
          id: rawId,
          type: "APPLICATION",
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        },
      });
    }

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const event = await eventRepo.findOne({ where: { id: entityId, tenant_id: tenantId } });

    if (!event) throw new AppError("APPROVAL_NOT_FOUND", 404, "Onay kaydı bulunamadı");
    let payload = AdminMobileApprovalsController.readEventPayload(event);
    if (event.status === NotificationEventStatus.PROCESSED) {
      return res.json({
        data: {
          id: rawId,
          type: kind === "payment" ? "PAYMENT" : "CHANGE_REQUEST",
          status: String(payload.status || payload.decision || "PROCESSED"),
          idempotent: true,
        },
      });
    }

    if (kind === "payment" && event.type === MEMBER_PAYMENT_REQUEST) {
      const applicationId = String(payload.application_id || "");
      const applicationRepo = AppDataSource.getRepository(SalonApplication);
      const application = applicationId
        ? await applicationRepo.findOne({ where: { id: applicationId, tenant_id: tenantId } })
        : null;

      const accountId = String(payload.account_id || "");
      let decisionTargetMemberId = String(payload.member_user_id || event.member_id || "");

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

          await AdminMobileApprovalsController.createDuoPartnerInviteIfNeeded({
            tenantId,
            adminId,
            event,
            primaryMemberUserId: memberUser.id,
          });
          payload = AdminMobileApprovalsController.readEventPayload(event);

          await MobilePurchaseSyncService.applyApprovedPurchaseContext({
            tenantId,
            memberUser,
            context: MobilePurchaseSyncService.normalizePurchaseContext(payload),
            requestId: event.id,
          });

          if (application) {
            application.status = SalonApplicationStatus.APPROVED;
            application.payment_status = MembershipPaymentStatus.VERIFIED;
            application.payment_confirmed_at = new Date();
            application.payment_reference = application.payment_reference || `mobile-${Date.now()}`;
            await applicationRepo.save(application);
          }

          payload = {
            ...AdminMobileApprovalsController.readEventPayload(event),
            decision: "APPROVED",
            status: "APPROVED",
            membership_id: activeMembership.id,
          };
          event.payload = payload;
          decisionTargetMemberId = memberUser.id;
        } else if (application) {
          if (application.status !== SalonApplicationStatus.APPROVED) {
            application.status = SalonApplicationStatus.APPROVED;
            application.payment_status = MembershipPaymentStatus.UNPAID;
          }

          application.note = JSON.stringify(payload);
          await applicationRepo.save(application);

          const result = await AdminSalonApplicationsController.activateMembershipForApplication({
            tenantId,
            approverId: adminId,
            application,
          });

          await AdminMobileApprovalsController.createDuoPartnerInviteIfNeeded({
            tenantId,
            adminId,
            event,
            primaryMemberUserId: result.linkedUser.id,
          });
          payload = AdminMobileApprovalsController.readEventPayload(event);
          await AdminMobileApprovalsController.attachDuoInviteToPrimaryRecords({
            tenantId,
            primaryMemberUserId: result.linkedUser.id,
            sourceRequestIds: [application.id, event.id],
            payload,
          });

          application.payment_status = MembershipPaymentStatus.VERIFIED;
          application.payment_confirmed_at = new Date();
          application.payment_reference = application.payment_reference || `mobile-${Date.now()}`;
          await applicationRepo.save(application);

          payload = {
            ...AdminMobileApprovalsController.readEventPayload(event),
            decision: "APPROVED",
            status: "APPROVED",
            membership_id: result.membership.id,
          };
          event.payload = payload;
          decisionTargetMemberId = result.linkedUser.id;
        } else {
          const memberUserId = String(payload.member_user_id || "");

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

          await AdminMobileApprovalsController.createDuoPartnerInviteIfNeeded({
            tenantId,
            adminId,
            event,
            primaryMemberUserId: memberUser.id,
          });
          payload = AdminMobileApprovalsController.readEventPayload(event);

          await MobilePurchaseSyncService.applyApprovedPurchaseContext({
            tenantId,
            memberUser,
            context: MobilePurchaseSyncService.normalizePurchaseContext(payload),
            requestId: event.id,
          });

          payload = {
            ...AdminMobileApprovalsController.readEventPayload(event),
            decision: "APPROVED",
            status: "APPROVED",
            membership_id: membership.id,
          };
          event.payload = payload;
          decisionTargetMemberId = memberUser.id;
        }

        event.status = NotificationEventStatus.PROCESSED;
        event.processed_at = new Date();
        event.triggered_by_admin_id = adminId || undefined;
        payload = AdminMobileApprovalsController.readEventPayload(event);
        if (String(payload.request_type || "").toUpperCase() === "DUO_PARTNER_PAYMENT") {
          await AdminMobileApprovalsController.finalizeDuoPartnerPayment({
            tenantId,
            payload,
          });
        }
      } else {
        event.status = NotificationEventStatus.PROCESSED;
        event.processed_at = new Date();
        event.triggered_by_admin_id = adminId || undefined;
        payload = { ...payload, decision: "REJECTED", status: "REJECTED" };
        event.payload = payload;
      }

      await eventRepo.save(event);

      payload = AdminMobileApprovalsController.readEventPayload(event);
      const requestType = String(payload.request_type || "").toUpperCase();
      const isDuoApproval =
        String(payload.lesson_mode || "").toUpperCase() === "DUO" || Boolean(payload.duo_payment);
      const shouldSendGenericDecisionPush =
        decision === "REJECT" || (!isDuoApproval && requestType !== "DUO_PARTNER_PAYMENT");
      if (decisionTargetMemberId && shouldSendGenericDecisionPush) {
        await AdminMobileApprovalsController.safeQueuePush({
          tenantId,
          userId: decisionTargetMemberId,
          roleScope: "MEMBER",
          type: decision === "APPROVE" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
          title: decision === "APPROVE" ? "Ödemen onaylandı" : "Ödeme talebin reddedildi",
          body:
            decision === "APPROVE"
              ? `${payload.package_title || "Paket"} için ödeme onaylandı.`
              : `${payload.package_title || "Paket"} için ödeme talebi reddedildi.`,
          deepLink: "fizyoflow://member/package",
          meta: {
            approval_id: rawId,
            package_id: payload.package_id || null,
            request_type: requestType || null,
          },
        });
      }

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
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "notification_event",
        target_id: event.id,
        metadata: {
          decision,
          status: String(payload.status),
          application_id: application?.id || null,
        },
      });

      return res.json({
        data: {
          id: rawId,
          type: "PAYMENT",
          status: String(payload.status),
        },
      });
    }

    if (kind === "change" && event.type === MEMBER_CHANGE_REQUEST) {
      const payload = AdminMobileApprovalsController.readEventPayload(event);
      const requestType = String(payload.request_type || "").toUpperCase();

      if (
        (requestType === "GROUP_CLASS_CREATE" ||
          requestType === "GROUP_CLASS_UPDATE" ||
          requestType === "GROUP_CLASS_CANCEL") &&
        payload.session_id
      ) {
        const sessionRepo = AppDataSource.getRepository(ClassSession);
        const session = await sessionRepo.findOne({
          where: { id: String(payload.session_id), tenant_id: tenantId },
        });

        if (session) {
          if (requestType === "GROUP_CLASS_CANCEL") {
            if (decision === "APPROVE") {
              await GroupClassCancellationService.cancelSession({
                tenantId,
                sessionId: session.id,
                canceledBy: "ADMIN",
                reason: "ADMIN_APPROVED_GROUP_CLASS_CANCEL",
                cancelSession: true,
              });
            } else {
              session.status = SessionStatus.SCHEDULED;
              session.meta = {
                ...(session.meta || {}),
                cancellation_rejected: {
                  rejected_by: adminId,
                  rejected_at: new Date().toISOString(),
                  reason: "ADMIN_REJECTED_GROUP_CLASS_CANCEL",
                },
              };
              await sessionRepo.save(session);
            }
          } else {
            session.status = decision === "APPROVE" ? SessionStatus.SCHEDULED : SessionStatus.CANCELED;
            await sessionRepo.save(session);
          }
        }
      }

      event.status = NotificationEventStatus.PROCESSED;
      event.processed_at = new Date();
      event.triggered_by_admin_id = adminId || undefined;
      event.payload = {
        ...payload,
        decision: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
      };
      const decidedPayload = AdminMobileApprovalsController.readEventPayload(event);

      await eventRepo.save(event);
      const isTrainerGroupClassRequest = requestType.startsWith("GROUP_CLASS_");
      await AdminMobileApprovalsController.safeQueuePush({
        tenantId,
        userId: event.member_id,
        roleScope: isTrainerGroupClassRequest ? "TRAINER" : "MEMBER",
        type: decision === "APPROVE" ? "CHANGE_REQUEST_APPROVED" : "CHANGE_REQUEST_REJECTED",
        title: decision === "APPROVE" ? "Talebin onaylandı" : "Talebin reddedildi",
        body: `${humanizeChangeRequestType(requestType)} ${decision === "APPROVE" ? "onaylandı" : "reddedildi"}.`,
        deepLink: isTrainerGroupClassRequest ? "fizyoflow://trainer/group-classes" : "fizyoflow://member/package",
        meta: {
          approval_id: rawId,
          request_type: requestType,
        },
      });

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
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "notification_event",
        target_id: event.id,
        metadata: {
          decision,
          status: String(decidedPayload.status),
          request_type: String(decidedPayload.request_type || ""),
        },
      });

      return res.json({
        data: {
          id: rawId,
          type: "CHANGE_REQUEST",
          status: String(decidedPayload.status),
        },
      });
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
    return `Seçim: ${selectedPackages
      .map((item: any) => item?.package_title || item?.package_id)
      .filter(Boolean)
      .join(", ")}.`;
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
  switch (String(value || "").toUpperCase()) {
    case "GROUP_CLASS_CREATE":
      return "Yeni grup dersi onayı";
    case "GROUP_CLASS_UPDATE":
      return "Grup dersi güncelleme onayı";
    case "GROUP_CLASS_CANCEL":
      return "Eğitmen silmek istiyor";
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
