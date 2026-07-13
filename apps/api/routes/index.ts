// Bu route dosyasi genel alanindaki index endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";

import { authRoutes } from "./auth.route";
import { publicRoutes } from "./public.route";
import { publicInvitesRoutes } from "./public-invites.route";
import { billingRoutes } from "./billing.route";
import { mobileDevicesRoutes } from "./mobile/devices.route";
import { mobileNotificationPreferencesRoutes } from "./mobile/notification-preferences.route";
import { mobileProductEventsRoutes } from "./mobile/product-events.route";
import { accountClinicRequestRoutes } from "./account/clinic-request.route";
import { internalClinicRequestsRoutes } from "./internal/clinic-requests.route";
import { internalAuditLogsRoutes } from "./internal/audit-logs.route";
import { internalE2ERoutes } from "./internal/e2e.route";
import { successResponseEnvelope } from "../middlewares/success-response.middleware";

// admin
import { adminDashboardRoutes } from "./admin/dashboard.route";
import { adminCmsRoutes } from "./admin/cms.route";
import { adminCampaignsRoutes } from "./admin/campaigns.route";
import { adminPackagesRoutes } from "./admin/package.route";
import { adminPackageTrainersRoutes } from "./admin/package-trainers.route";
import { adminMembersRoutes } from "./admin/members.route";
import { adminTrainersRoutes } from "./admin/trainers.route";
import { adminSessionsRoutes } from "./admin/session.route";
import { adminBookingsRoutes } from "./admin/booking.route";
import { adminPaymentsRoutes } from "./admin/payments.route";
import { adminRevenueRoutes } from "./admin/revenue.route";
import { adminMeasurementsRoutes } from "./admin/measurements.route";
import { adminRiskRoutes } from "./admin/risk.route";
import { adminReferralsRoutes } from "./admin/referral.route";
import { adminLeadsRoutes } from "./admin/lead.route";
import { adminSettingsRoutes } from "./admin/settings.route";
import { adminInvitesRoutes } from "./admin/invites.route";
import { adminClinicRoutes } from "./admin/clinic.route";
import { adminQrRoutes } from "./admin/qr.route";
import { adminSalonApplicationsRoutes } from "./admin/salon-applications.route";
import { adminMobileApprovalsRoutes } from "./admin/mobile-approvals.route";

// trainer
import { trainerTodayRoutes } from "./trainer/today.route";
import { trainerCheckinRoutes } from "./trainer/checkin.route";
import { trainerMembersRoutes } from "./trainer/members.route";
import { trainerBookingsRoutes } from "./trainer/booking.route";
import { trainerMeasurementsRoutes } from "./trainer/measurements";
import { trainerRiskRoutes } from "./trainer/risk.route";
import { trainerQrRoutes } from "./trainer/qr.route";
import { trainerGroupClassesRoutes } from "./trainer/group-classes.route";

// member
import { memberHomeRoutes } from "./member/home.route";
import { memberQrRoutes } from "./member/qr.route";
import { memberAvailabilityRoutes } from "./member/availability.route";
import { memberBookingsRoutes } from "./member/booking.route";
import { memberPackagesRoutes } from "./member/package.route";
import { memberMeasurementsRoutes } from "./member/measurement.route";
import { memberReferralsRoutes } from "./member/referral.route";
import { memberAttendanceRoutes } from "./member/attendance.route";
import { memberSalonApplicationsRoutes } from "./member/salon-applications.route";
import { memberMobileRequestsRoutes } from "./member/mobile-requests.route";
import { memberRealtimeRoutes } from "./member/realtime.route";
import { memberGroupClassesRoutes } from "./member/group-classes.route";

// Uygulamadaki tum route modullerinin toplandigi ana router.
// Yeni bir API surface'i eklendiginde genelde iki yer etkilenir:
// ilgili route dosyasi ve bu merkezi baglama noktasi.
export const appRouter = Router();

appRouter.use(successResponseEnvelope);

// Auth/public route'lari tenant bagimsiz veya login oncesi akislar icindir.
appRouter.use("/auth", authRoutes);
appRouter.use("/public", publicRoutes);
appRouter.use("/public/invites", publicInvitesRoutes);
appRouter.use("/billing", billingRoutes);
appRouter.use("/mobile/devices", mobileDevicesRoutes);
appRouter.use("/mobile/notification-preferences", mobileNotificationPreferencesRoutes);
appRouter.use("/mobile/product-events", mobileProductEventsRoutes);
appRouter.use("/account/clinic-request", accountClinicRequestRoutes);
appRouter.use("/internal/clinic-requests", internalClinicRequestsRoutes);
appRouter.use("/internal/audit-logs", internalAuditLogsRoutes);
appRouter.use("/internal/e2e", internalE2ERoutes);

// Admin route'lari salon yonetim ekranlarini besler.
appRouter.use("/admin/dashboard", adminDashboardRoutes);
appRouter.use("/admin/cms", adminCmsRoutes);
appRouter.use("/admin/campaigns", adminCampaignsRoutes);
appRouter.use("/admin/packages", adminPackagesRoutes);
appRouter.use("/admin/package-trainers", adminPackageTrainersRoutes);
appRouter.use("/admin/members", adminMembersRoutes);
appRouter.use("/admin/trainers", adminTrainersRoutes);
appRouter.use("/admin/sessions", adminSessionsRoutes);
appRouter.use("/admin/bookings", adminBookingsRoutes);
appRouter.use("/admin/payments", adminPaymentsRoutes);
appRouter.use("/admin/revenue", adminRevenueRoutes);
appRouter.use("/admin/measurements", adminMeasurementsRoutes);
appRouter.use("/admin/risk", adminRiskRoutes);
appRouter.use("/admin/referrals", adminReferralsRoutes);
appRouter.use("/admin/leads", adminLeadsRoutes);
appRouter.use("/admin/settings", adminSettingsRoutes);
appRouter.use("/admin/invites", adminInvitesRoutes);
appRouter.use("/admin/clinic", adminClinicRoutes);
appRouter.use("/admin/qr", adminQrRoutes);
appRouter.use("/admin/salon-applications", adminSalonApplicationsRoutes);
appRouter.use("/admin/mobile-approvals", adminMobileApprovalsRoutes);

// Trainer route'lari egitmen uygulama yuzeylerini besler.
appRouter.use("/trainer/today", trainerTodayRoutes);
appRouter.use("/trainer/checkin", trainerCheckinRoutes);
appRouter.use("/trainer/members", trainerMembersRoutes);
appRouter.use("/trainer/bookings", trainerBookingsRoutes);
appRouter.use("/trainer/group-classes", trainerGroupClassesRoutes);
appRouter.use("/trainer/measurements", trainerMeasurementsRoutes);
appRouter.use("/trainer/risk", trainerRiskRoutes);
appRouter.use("/trainer/qr", trainerQrRoutes);

// Member route'lari uye deneyimi ve mobil satin alma akislarini tasir.
appRouter.use("/member/home", memberHomeRoutes);
appRouter.use("/member/qr", memberQrRoutes);
appRouter.use("/member/availability", memberAvailabilityRoutes);
appRouter.use("/member/packages", memberPackagesRoutes);
appRouter.use("/member/bookings", memberBookingsRoutes);
appRouter.use("/member/measurements", memberMeasurementsRoutes);
appRouter.use("/member/referrals", memberReferralsRoutes);
appRouter.use("/member/attendance", memberAttendanceRoutes);
appRouter.use("/member/group-classes", memberGroupClassesRoutes);
appRouter.use("/member/salon-applications", memberSalonApplicationsRoutes);
appRouter.use("/member/realtime", memberRealtimeRoutes);
appRouter.use("/member", memberMobileRequestsRoutes);
