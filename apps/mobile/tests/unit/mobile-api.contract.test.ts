import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminCampaignApi,
  createMemberChangeRequestApi,
  createAdminPackageApi,
  createMemberMeasurementApi,
  createMemberPaymentRequestApi,
  getAdminMobileApprovalsApi,
  getAdminCampaignsApi,
  getAdminClinicQrApi,
  syncAdminClinicSubscriptionApi,
  getSalonDayOptionsApi,
  getAdminPackagesApi,
  getMemberMeasurementsApi,
  getMemberPackagesApi,
  getMemberPaymentRequestsApi,
  getMemberReferralsApi,
  adminSalonEntryScanApi,
  getTrainerRiskApi,
  getTrainerTodayApi,
  loginApi,
  trainerManualCheckinApi,
  trainerQrCheckinApi,
} from "@/lib/mobile-api";
import { loginApi as domainLoginApi } from "@/lib/api/auth";
import { getPublicSalonsApi as domainGetPublicSalonsApi } from "@/lib/api/public";
import { getMemberPackagesApi as domainGetMemberPackagesApi } from "@/lib/api/member";
import { getTrainerTodayApi as domainGetTrainerTodayApi } from "@/lib/api/trainer";
import { getAdminPackagesApi as domainGetAdminPackagesApi } from "@/lib/api/admin";
import { syncAdminClinicSubscriptionApi as domainSyncAdminClinicSubscriptionApi } from "@/lib/api/subscription";

const { httpRequest } = vi.hoisted(() => ({
  httpRequest: vi.fn(),
}));

vi.mock("@/lib/http-client", () => ({
  httpRequest,
}));

describe("mobile api contract helpers", () => {
  beforeEach(() => {
    httpRequest.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps domain modules and the legacy barrel on the same function contracts", () => {
    expect(domainLoginApi).toBe(loginApi);
    expect(domainGetPublicSalonsApi).toBeDefined();
    expect(domainGetMemberPackagesApi).toBe(getMemberPackagesApi);
    expect(domainGetTrainerTodayApi).toBe(getTrainerTodayApi);
    expect(domainGetAdminPackagesApi).toBe(getAdminPackagesApi);
    expect(domainSyncAdminClinicSubscriptionApi).toBe(syncAdminClinicSubscriptionApi);
  });

  it("loads and creates member measurements through the expected endpoints", async () => {
    httpRequest.mockResolvedValueOnce([{ id: "m-1" }]).mockResolvedValueOnce({ id: "m-2" });

    const rows = await getMemberMeasurementsApi();
    const created = await createMemberMeasurementApi({
      measured_at: "2026-04-23T09:00:00.000Z",
      height_cm: 178,
      weight_kg: 74,
      fat_percent: 18,
      muscle_kg: 31,
    });

    expect(rows).toEqual([{ id: "m-1" }]);
    expect(created).toEqual({ id: "m-2" });
    expect(httpRequest).toHaveBeenNthCalledWith(1, "/member/measurements");
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/member/measurements", {
      method: "POST",
      body: {
        measured_at: "2026-04-23T09:00:00.000Z",
        height_cm: 178,
        weight_kg: 74,
        fat_percent: 18,
        muscle_kg: 31,
      },
    });
  });

  it("keeps production login on auth endpoint and sends dev e2e login to internal helper", async () => {
    vi.stubGlobal("__DEV__", true);
    httpRequest.mockResolvedValueOnce({ accessToken: "prod-token" }).mockResolvedValueOnce({ accessToken: "e2e-token" });

    await loginApi({ email: "member@gmail.com", password: "member123" });
    await loginApi({ email: "multi.persona@demo.local", password: "multi123", role: "TRAINER", e2e: true });

    expect(httpRequest).toHaveBeenNthCalledWith(1, "/auth/login", {
      method: "POST",
      auth: false,
      body: {
        email: "member@gmail.com",
        password: "member123",
      },
    });
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/internal/e2e/session", {
      method: "POST",
      auth: false,
      body: {
        email: "multi.persona@demo.local",
        password: "multi123",
        role: "TRAINER",
      },
    });
  });

  it("sends trainer check-in requests to dedicated manual and qr endpoints", async () => {
    httpRequest.mockResolvedValue({ attendanceId: "a-1" });

    await trainerManualCheckinApi({ manual_code: "member@gmail.com", session_id: "session-1" });
    await trainerQrCheckinApi({ qr_code: "FYF-MEMBER-001", scan_context: "TRAINER_CHECKIN" });

    expect(httpRequest).toHaveBeenNthCalledWith(1, "/trainer/checkin/manual", {
      method: "POST",
      body: { manual_code: "member@gmail.com", session_id: "session-1" },
    });
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/trainer/checkin/qr", {
      method: "POST",
      body: { qr_code: "FYF-MEMBER-001", scan_context: "TRAINER_CHECKIN" },
    });
  });

  it("receives the normalized admin package list from the HTTP client", async () => {
    httpRequest.mockResolvedValueOnce([{ id: "pkg-1", title: "Starter" }]);

    const packages = await getAdminPackagesApi();

    expect(packages).toEqual([{ id: "pkg-1", title: "Starter" }]);
    expect(httpRequest).toHaveBeenNthCalledWith(1, "/admin/packages");
  });

  it("creates admin packages and fetches mobile approvals with domain payloads", async () => {
    httpRequest
      .mockResolvedValueOnce({ id: "pkg-3", title: "QA Smoke Paket" })
      .mockResolvedValueOnce([{ id: "approval-1", type: "PAYMENT" }]);

    const created = await createAdminPackageApi({
      title: "QA Smoke Paket",
      total_credits: 6,
      duration_days: 21,
      service_key: "REFORMER",
      display_price: 4200,
      trainer_commission_rate: 30,
      capacity: 1,
      summary: "Smoke package create flow",
    });
    const approvals = await getAdminMobileApprovalsApi();

    expect(created).toEqual({ id: "pkg-3", title: "QA Smoke Paket" });
    expect(approvals).toEqual([{ id: "approval-1", type: "PAYMENT" }]);
    expect(httpRequest).toHaveBeenNthCalledWith(1, "/admin/packages", {
      method: "POST",
      body: {
        title: "QA Smoke Paket",
        total_credits: 6,
        duration_days: 21,
        service_key: "REFORMER",
        display_price: 4200,
        trainer_commission_rate: 30,
        capacity: 1,
        summary: "Smoke package create flow",
      },
    });
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/admin/mobile-approvals");
  });

  it("covers member package, referral and request endpoints", async () => {
    httpRequest
      .mockResolvedValueOnce([{ id: "pkg-1" }])
      .mockResolvedValueOnce([{ id: "ref-1" }])
      .mockResolvedValueOnce([{ id: "pay-1" }])
      .mockResolvedValueOnce({ id: "pay-2" })
      .mockResolvedValueOnce({ id: "chg-1" });

    await expect(getMemberPackagesApi()).resolves.toEqual([{ id: "pkg-1" }]);
    await expect(getMemberReferralsApi()).resolves.toEqual([{ id: "ref-1" }]);
    await expect(getMemberPaymentRequestsApi()).resolves.toEqual([{ id: "pay-1" }]);
    await createMemberPaymentRequestApi({
      tenant_slug: "demo-salon",
      selected_days: [{ starts_at: "2026-04-25T09:00:00.000Z", ends_at: "2026-04-25T10:00:00.000Z", label: "Cuma 09:00" }],
      package_id: "pkg-1",
      trainer_id: "trainer-1",
    });
    await createMemberChangeRequestApi({ type: "PACKAGE_RENEWAL", note: "Yeni paket" });

    expect(httpRequest).toHaveBeenNthCalledWith(1, "/member/packages");
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/member/referrals");
    expect(httpRequest).toHaveBeenNthCalledWith(3, "/member/purchase-requests");
    expect(httpRequest).toHaveBeenNthCalledWith(4, "/member/purchase-requests", {
      method: "POST",
      body: {
        tenant_slug: "demo-salon",
        selected_days: [{ starts_at: "2026-04-25T09:00:00.000Z", ends_at: "2026-04-25T10:00:00.000Z", label: "Cuma 09:00" }],
        package_id: "pkg-1",
        trainer_id: "trainer-1",
      },
    });
    expect(httpRequest).toHaveBeenNthCalledWith(5, "/member/change-requests", {
      method: "POST",
      body: { type: "PACKAGE_RENEWAL", note: "Yeni paket" },
    });
  });

  it("covers trainer today and admin campaign contract endpoints", async () => {
    httpRequest
      .mockResolvedValueOnce({ kpis: {} })
      .mockResolvedValueOnce([{ member_id: "member-1" }])
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ campaign: { id: "camp-1" } });

    await expect(getTrainerTodayApi()).resolves.toEqual({ kpis: {} });
    await expect(getTrainerRiskApi()).resolves.toEqual([{ member_id: "member-1" }]);
    await expect(getAdminCampaignsApi()).resolves.toEqual({ items: [] });
    await createAdminCampaignApi({
      name: "Referans Bahar",
      audience: "ALL",
      trigger_type: "REFERRAL",
      trigger_count: 2,
      reward_type: "FREE_CLASS",
      reward_value: 1,
      reward_target: "REFERRER",
      is_active: true,
    });

    expect(httpRequest).toHaveBeenNthCalledWith(1, "/trainer/today");
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/trainer/risk/members");
    expect(httpRequest).toHaveBeenNthCalledWith(3, "/admin/campaigns");
    expect(httpRequest).toHaveBeenNthCalledWith(4, "/admin/campaigns", {
      method: "POST",
      body: {
        name: "Referans Bahar",
        audience: "ALL",
        trigger_type: "REFERRAL",
        trigger_count: 2,
        reward_type: "FREE_CLASS",
        reward_value: 1,
        reward_target: "REFERRER",
        is_active: true,
      },
    });
  });

  it("loads admin clinic qr payload, syncs subscription and sends salon entry scan requests", async () => {
    httpRequest
      .mockResolvedValueOnce({
        tenant_id: "tenant-1",
        qr_code: "FYF-DEMO-001",
        qr_payload: "https://join.example.com/join/demo-salon?code=FYF-DEMO-001",
      })
      .mockResolvedValueOnce({ subscription_status: "ACTIVE", sync_state: "SYNCED" })
      .mockResolvedValueOnce({ success: true });

    const clinicQr = await getAdminClinicQrApi();
    const syncResult = await syncAdminClinicSubscriptionApi();
    const scanResult = await adminSalonEntryScanApi({ manual_code: "MEM-ABCD1234" });

    expect(clinicQr).toEqual({
      tenant_id: "tenant-1",
      qr_code: "FYF-DEMO-001",
      qr_payload: "https://join.example.com/join/demo-salon?code=FYF-DEMO-001",
    });
    expect(syncResult).toEqual({ subscription_status: "ACTIVE", sync_state: "SYNCED" });
    expect(scanResult).toEqual({ success: true });
    expect(httpRequest).toHaveBeenNthCalledWith(1, "/admin/clinic/qr");
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/admin/clinic/subscription/sync", {
      method: "POST",
    });
    expect(httpRequest).toHaveBeenNthCalledWith(3, "/admin/qr/scan-entry", {
      method: "POST",
      body: { manual_code: "MEM-ABCD1234" },
    });
  });

  it("sends selected package ids while loading salon day options", async () => {
    httpRequest.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getSalonDayOptionsApi("demo-salon", ["pkg-1", "pkg-2"]);
    await getSalonDayOptionsApi("demo-salon");

    expect(httpRequest).toHaveBeenNthCalledWith(1, "/public/salons/demo-salon/day-options?package_ids=pkg-1%2Cpkg-2", {
      auth: false,
    });
    expect(httpRequest).toHaveBeenNthCalledWith(2, "/public/salons/demo-salon/day-options", {
      auth: false,
    });
  });
});
