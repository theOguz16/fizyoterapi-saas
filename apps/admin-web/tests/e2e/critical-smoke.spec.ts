import { expect, Page, Route, test } from "@playwright/test";

type Role = "ADMIN" | "TRAINER" | "MEMBER";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:2929";

type ApiMockOptions = {
  role: Role;
  noBookablePackage?: boolean;
  weeklyClassHours?: number;
  noAvailabilities?: boolean;
  bookingCreateErrorMessage?: string;
};

function buildUser(role: Role) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: role === "ADMIN" ? "admin@demo.local" : role === "TRAINER" ? "trainer@demo.local" : "member@demo.local",
    role,
    tenantId: "tenant-1",
    tenantSlug: "demo-salon",
    fullName: role === "ADMIN" ? "Demo Admin" : role === "TRAINER" ? "Demo Trainer" : "Demo Member",
  };
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

async function setE2EAuthCookies(page: Page, role: Role) {
  await page.context().addCookies([
    { name: "e2e_role", value: role, url: baseURL },
    { name: "e2e_web_enabled", value: "true", url: baseURL },
    { name: "e2e_user_id", value: `${role.toLowerCase()}-1`, url: baseURL },
    { name: "e2e_email", value: `${role.toLowerCase()}@demo.local`, url: baseURL },
    { name: "e2e_tenant_id", value: "tenant-1", url: baseURL },
    { name: "e2e_tenant_slug", value: "demo-salon", url: baseURL },
    { name: "e2e_full_name", value: `Demo ${role}`, url: baseURL },
  ]);
}

async function mockApi(page: Page, options: ApiMockOptions) {
  await setE2EAuthCookies(page, options.role);
  const user = buildUser(options.role);
  const noBookablePackage = Boolean(options.noBookablePackage);
  const noAvailabilities = Boolean(options.noAvailabilities);
  const memberId = "member-1";
  const packageId = "package-1";
  const weeklyClassHours = Math.min(7, Math.max(1, options.weeklyClassHours || 2));

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");

    if (path === "/auth/me") {
      return json(route, { data: { user } });
    }

    if (path === "/auth/login" && method === "POST") {
      return json(route, { data: { user } });
    }

    if (path === "/auth/logout" && method === "POST") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/admin/dashboard/summary") {
      return json(route, {
        tenant_id: "tenant-1",
        kpis: { active_trainers: 2, active_members: 6, at_risk_members: 1, todays_bookings: 3, todays_sessions: 2 },
        revenue: { daily: 1200, weekly: 5400, monthly: 21800, yearly: 242000 },
        package_sales: { weekly_credits_sold: 20, monthly_credits_sold: 80, weekly_pack_8_count: 2, weekly_pack_4_count: 1 },
        risk_preview: [],
        spotlight: { trainers: [], members: [] },
      });
    }

    if (path === "/admin/trainers") {
      return json(route, { data: [{ id: "tr-1", first_name: "Demo", last_name: "Trainer", email: "trainer@demo.local", is_active: true }] });
    }

    if (path === "/admin/members") {
      return json(route, { data: [{ id: "mb-1", first_name: "Demo", last_name: "Member", email: "member@demo.local", is_active: true }] });
    }

    if (path === "/trainer/today") {
      return json(route, {
        data: {
          date: "2026-03-05",
          calendar: {
            business_hours: {
              timezone: "Europe/Istanbul",
              working_days: [1, 2, 3, 4, 5, 6, 7],
              start_time: "09:00",
              end_time: "18:00",
              lunch_break_start: "12:00",
              lunch_break_end: "13:00",
              slot_minutes: 30,
            },
          },
          summary: {
            booking_total: 2,
            pending_bookings: 1,
            approved_bookings: 1,
            session_total: 2,
            weekly_session_total: 5,
            member_total: 8,
            scheduled_sessions: 2,
            completed_sessions: 1,
            checkin_total: 1,
            deducted_credits_total: 1,
          },
          risk: { at_risk_count: 1, preview: [{ member_id: "member-1", full_name: "Demo Member", level: "MEDIUM", score: 65 }] },
          earnings: {
            month_gross_total: 12000,
            month_trainer_income: 3000,
            month_commission_rate: 25,
            month_credited_lessons: 10,
          },
          bookings: [],
          sessions: [],
          checkins: [],
        },
      });
    }

    if (path === "/trainer/risk/members") {
      return json(route, {
        data: [
          {
            member_id: "member-1",
            full_name: "Demo Member",
            email: "member@demo.local",
            score: 67,
            level: "MEDIUM",
            reasons: ["Son ölçüm gecikmesi"],
            days_since_attendance: 4,
            days_since_measurement: 12,
          },
        ],
        total: 1,
      });
    }

    if (path === "/trainer/bookings/form-options") {
      return json(route, {
        data: {
          members: [{ id: memberId, full_name: "Demo Member", email: "member@demo.local" }],
          packages: [
            {
              id: packageId,
              title: "8'li Grup Paketi",
              service_name: "Grup Dersi",
              display_price: "200",
              lesson_category: "GRUP",
            },
          ],
          trainer_assigned_packages: noBookablePackage ? [] : [packageId],
          member_active_package_ids: { [memberId]: [packageId] },
          member_bookable_package_ids: { [memberId]: noBookablePackage ? [] : [packageId] },
          member_package_diagnostics: {
            [memberId]: {
              active_member_packages: [packageId],
              trainer_assigned_packages: noBookablePackage ? [] : [packageId],
              intersection_packages: noBookablePackage ? [] : [packageId],
              reason_codes: noBookablePackage ? ["NO_TRAINER_ASSIGNMENT"] : [],
            },
          },
          allowed_categories: ["GRUP"],
          slot_contract: {
            timezone: "Europe/Istanbul",
            working_days: [1, 2, 3, 4, 5, 6, 7],
            start_time: "09:00",
            end_time: "18:00",
            lunch_break_start: "12:00",
            lunch_break_end: "13:00",
            slot_minutes: 30,
          },
        },
      });
    }

    if (path === "/trainer/bookings/availabilities") {
      return json(route, {
        data: noAvailabilities
          ? []
          : [
              {
                id: "avail-1",
                member_id: memberId,
                member_full_name: "Demo Member",
                member_email: "member@demo.local",
                member_weekly_class_hours: 2,
                starts_at: "2026-03-04T12:00:00.000Z",
                ends_at: "2026-03-04T13:00:00.000Z",
                package_id: packageId,
                package_title: "8'li Grup Paketi",
                package_display_price: "200",
                package_lesson_category: "GRUP",
                note: "Akşam saatleri uygun",
              },
            ],
      });
    }

    if (path === "/trainer/bookings" && method === "GET") {
      return json(route, { data: [] });
    }

    if (path === "/trainer/bookings" && method === "POST") {
      if (options.bookingCreateErrorMessage) {
        return json(
          route,
          {
            error: {
              code: "MEMBER_OVERLAP",
              message: options.bookingCreateErrorMessage,
            },
          },
          400
        );
      }
      return json(route, { data: { id: "booking-1" } }, 201);
    }

    if (path.startsWith("/trainer/bookings/") && path.endsWith("/status") && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/member/home") {
      return json(route, {
        data: {
          member: {
            id: memberId,
            full_name: "Demo Member",
            email: "member@demo.local",
            phone: "5550000003",
            is_active: true,
            weekly_class_hours: weeklyClassHours,
          },
          packages: {
            active_package_count: 1,
            total_remaining_credits: 6,
            nearest_expiry: "2026-04-01T00:00:00.000Z",
          },
          lesson_usage: {
            weekly_target: weeklyClassHours,
            attended_this_week: 1,
            attended_total: 14,
            group_attended_total: 6,
            remaining_total_credits: 6,
          },
          upcoming_bookings: [],
          recent_attendance: [],
          latest_measurement: null,
          referrals: { invited: 2, converted: 1, rewarded: 0, canceled: 0, total: 2 },
          referral_wallet: { group_class_credits: 1 },
          calendar: {
            business_hours: {
              timezone: "Europe/Istanbul",
              working_days: [1, 2, 3, 4, 5, 6, 7],
              start_time: "09:00",
              end_time: "18:00",
              lunch_break_start: "12:00",
              lunch_break_end: "13:00",
              slot_minutes: 60,
            },
          },
        },
      });
    }

    if (path === "/member/packages") {
      return json(route, {
        data: [{ id: packageId, title: "8'li Skolyoz Paketi", type: "PACKAGE", display_price: "500" }],
      });
    }

    if (path === "/member/availability" && method === "GET") {
      return json(route, { data: [] });
    }

    if (path === "/member/home/weekly-class-hours" && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/member/availability" && method === "POST") {
      return json(route, {
        data: {
          selected_slots: 6,
          trainer_free_slots: 4,
          required_slots: 6,
          required_trainer_free_slots: 4,
          is_valid: true,
        },
      });
    }

    if (path === "/member/attendance/history") {
      return json(route, {
        data: [
          {
            id: "att-1",
            created_at: "2026-03-05T09:00:00.000Z",
            result: "CREDIT_DEDUCTED",
            credits_deducted: 1,
            trainer_full_name: "Demo Trainer",
            session_title: "Grup Dersi",
            lesson_category: "GRUP",
            package_title: "8'li Skolyoz Paketi",
            package_display_price: "500",
            remaining_credits: 6,
          },
        ],
        summary: {
          total: 1,
          creditDeductedCount: 1,
          noCreditCount: 0,
          packageExpiredCount: 0,
          userInactiveCount: 0,
          totalCreditsDeducted: 1,
          total_attendance_count: 1,
          group_attendance_count: 1,
          remaining_total_credits: 6,
        },
        package_balances: [
          {
            user_package_id: "up-1",
            package_id: packageId,
            package_title: "8'li Skolyoz Paketi",
            package_display_price: "500",
            total_credits: 8,
            remaining_credits: 6,
            used_credits: 2,
            expires_at: "2026-04-01T00:00:00.000Z",
            starts_at: "2026-03-01T00:00:00.000Z",
          },
        ],
        upcoming_bookings: [
          {
            id: "b-up-1",
            starts_at: "2026-03-20T09:00:00.000Z",
            ends_at: "2026-03-20T10:00:00.000Z",
            status: "PENDING",
            trainer_full_name: "Demo Trainer",
            session_title: "Skolyoz Seansı",
            lesson_category: "SKOLYOZ",
            package_title: "8'li Skolyoz Paketi",
            package_display_price: "500",
          },
        ],
        past_bookings: [],
        limit: 100,
      });
    }

    if (path === "/admin/invites" && method === "GET") {
      return json(route, { data: [] });
    }

    if (path === "/admin/invites" && method === "POST") {
      return json(route, {
        data: {
          id: "inv-1",
          role: "TRAINER",
          email_or_phone: "test@demo.local",
          status: "PENDING",
          expires_at: "2026-03-10T10:00:00.000Z",
          created_at: "2026-03-05T10:00:00.000Z",
          invite_url: "http://localhost:2929/invite/accept?token=demo",
        },
      });
    }

    if (path === "/admin/salon-applications" && method === "GET") {
      return json(route, {
        data: [
          {
            id: "app-1",
            status: "PENDING",
            payment_status: "UNPAID",
            created_at: "2026-03-05T10:00:00.000Z",
            applicant: {
              id: "member-1",
              full_name: "Demo Başvuru",
              email: "member@demo.local",
              phone: "5550000003",
            },
          },
          {
            id: "app-2",
            status: "APPROVED",
            payment_status: "UNPAID",
            created_at: "2026-03-06T10:00:00.000Z",
            applicant: {
              id: "member-2",
              full_name: "Ödeme Bekleyen",
              email: "waiting@demo.local",
              phone: "5550000004",
            },
          },
        ],
      });
    }

    if (path === "/admin/salon-applications/app-1/approve" && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/admin/salon-applications/app-2/payment-verify" && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/admin/salon-applications/app-2/reject" && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    if (path === "/admin/payments/requests" && method === "GET") {
      return json(route, {
        data: [
          {
            id: "pay-1",
            member_id: "member-1",
            member_full_name: "Demo Member",
            member_email: "member@demo.local",
            trainer_id: "tr-1",
            trainer_full_name: "Demo Trainer",
            starts_at: "2026-03-05T09:00:00.000Z",
            ends_at: "2026-03-05T10:00:00.000Z",
            status: "PENDING",
            payment_status: "REQUESTED",
            package_id: "package-1",
            package_title: "8'li Grup Paketi",
            payment_requested_at: "2026-03-05T11:00:00.000Z",
          },
        ],
      });
    }

    if (path === "/admin/payments/requests/pay-1/approve" && method === "PATCH") {
      return json(route, { data: { ok: true } });
    }

    return json(route, { data: {} });
  });
}

test("login ekranı açılır", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Salon Operasyon Girişi")).toBeVisible();
});

test.describe("Kritik smoke", () => {
  test("cookie-first login sonrası dashboard erişimi", async ({ page }) => {
    await mockApi(page, { role: "ADMIN" });

    await page.goto("/login");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Klinik Yönetim Dashboard")).toBeVisible();
    await expect(page.getByText("Günlük Kazanç")).toBeVisible();
  });

  test("trainer takvim ekranında manuel akış ve sürükle-bırak kartları görünür", async ({ page }) => {
    await mockApi(page, { role: "TRAINER" });

    await page.goto("/trainer/bookings");
    await expect(page.getByText("Takvim ve Randevu Yönetimi")).toBeVisible();
    await expect(page.getByText("Yeni Planlama Akışı")).toBeVisible();
    await expect(page.getByRole("button", { name: "Takvime Aktar" }).first()).toBeVisible();
  });

  test("trainer takvim manuel talep ile booking oluşturur", async ({ page }) => {
    await mockApi(page, { role: "TRAINER" });

    await page.goto("/trainer/bookings");
    const suggestionCard = page.locator("article").filter({ hasText: "Demo Member" }).first();
    await expect(suggestionCard).toBeVisible();
    await suggestionCard.getByRole("button", { name: "İlk 2 slotu seç" }).click();

    const bookingRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/trainer/bookings") && resp.request().method() === "POST"
    );
    await suggestionCard.getByRole("button", { name: "Takvime Aktar" }).click();
    const response = await bookingRequest;
    expect(response.status()).toBe(201);
  });

  test("trainer takvim overlap durumunda 400 döner", async ({ page }) => {
    await mockApi(page, { role: "TRAINER", bookingCreateErrorMessage: "Üyenin aynı saatte başka bir randevusu var" });

    await page.goto("/trainer/bookings");
    const suggestionCard = page.locator("article").filter({ hasText: "Demo Member" }).first();
    await expect(suggestionCard).toBeVisible();
    await suggestionCard.getByRole("button", { name: "İlk 2 slotu seç" }).click();

    const bookingRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/trainer/bookings") && resp.request().method() === "POST"
    );
    await suggestionCard.getByRole("button", { name: "Takvime Aktar" }).click();
    const response = await bookingRequest;
    expect(response.status()).toBe(400);
  });

  test("paket yoksa Türkçe teşhis metni gösterilir", async ({ page }) => {
    await mockApi(page, { role: "TRAINER", noBookablePackage: true });

    await page.goto("/trainer/bookings");
    await expect(page.getByText("Üyenin aktif paketlerinden hiçbiri size atanmış değil.")).toBeVisible();
  });

  test("müsaitlik boşsa boş durum mesajı gösterilir", async ({ page }) => {
    await mockApi(page, { role: "TRAINER", noAvailabilities: true });

    await page.goto("/trainer/bookings");
    await expect(page.getByText("Bu hafta uygun slot görünmüyor")).toBeVisible();
  });

  test("risk ekranında limit alanı görünmez", async ({ page }) => {
    await mockApi(page, { role: "TRAINER" });

    await page.goto("/trainer/risk");
    await expect(page.getByRole("heading", { name: "Filtreler" })).toBeVisible();
    await expect(page.getByText("Limit, risk listesinde")).toHaveCount(0);
    await expect(page.getByPlaceholder("Maksimum kayıt")).toHaveCount(0);
  });

  test("trainer today ekranında sadece eğitmen kazancı kartı görünür", async ({ page }) => {
    await mockApi(page, { role: "TRAINER" });

    await page.goto("/trainer/today");
    await expect(page.getByText("Bu Ay Eğitmen Kazancın")).toBeVisible();
    await expect(page.getByText("Bu Ay Toplam Ciro")).toHaveCount(0);
    await expect(page.getByText("Ortalama Prim Oranın")).toHaveCount(0);
  });

  test("clipboard fallback Türkçe manuel kopyala deneyimi", async ({ page }) => {
    await page.addInitScript(() => {
      const clipboard = {
        writeText: async () => {
          throw new Error("denied");
        },
      };
      Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    });

    await mockApi(page, { role: "ADMIN" });

    await page.goto("/admin/invites");
    await page.getByPlaceholder("eposta@ornek.com veya 5551234567").fill("test@demo.local");
    await page.getByRole("button", { name: "Davet Oluştur" }).click();

    await expect(page.getByRole("heading", { name: "Manuel Kopyalama" })).toBeVisible();
    await expect(page.getByText("Panoya kopyalama izni verilmedi")).toBeVisible();
  });

  test("başvuru ön onayı ödeme akışına aktarılır", async ({ page }) => {
    await mockApi(page, { role: "ADMIN" });

    await page.goto("/admin/applications");
    await expect(page.getByRole("heading", { name: "Başvurular" })).toBeVisible();
    const approveRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/salon-applications/app-1/approve") && resp.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "Ödemeye Aktar" }).first().click();
    const response = await approveRequest;
    expect(response.status()).toBe(200);
  });

  test("üyelik ödemesi onaylanınca salon üyeliği aktive edilir", async ({ page }) => {
    await mockApi(page, { role: "ADMIN" });

    await page.goto("/admin/payments");
    await expect(page.getByText("Salon Katılım Ödemeleri")).toBeVisible();
    const membershipPaymentsSection = page.locator(".surface-card").filter({ hasText: "Salon Katılım Ödemeleri" }).first();
    await expect(membershipPaymentsSection).toBeVisible();
    const approveMembershipRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/salon-applications/app-2/payment-verify") && resp.request().method() === "PATCH"
    );
    await membershipPaymentsSection.getByRole("button", { name: "Onayla" }).first().click();
    const response = await approveMembershipRequest;
    expect(response.status()).toBe(200);
  });
});
