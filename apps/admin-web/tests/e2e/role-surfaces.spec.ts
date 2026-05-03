import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:2929";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function setE2EAuthCookies(page: any, role: "ADMIN" | "TRAINER") {
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

async function mockAdminSurface(page: any) {
  await setE2EAuthCookies(page, "ADMIN");
  await page.route("**/api/**", async (route: any) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");

    if (path === "/auth/me") {
      return route.fulfill(
        json({
          data: {
            user: {
              id: "admin-1",
              email: "admin@demo.local",
              role: "ADMIN",
              tenantId: "tenant-1",
              tenantSlug: "demo",
            },
            available_surfaces: { web: true },
          },
        })
      );
    }

    if (path === "/admin/dashboard/summary") {
      return route.fulfill(
        json({
          tenant_id: "tenant-1",
          kpis: { active_trainers: 2, active_members: 9, at_risk_members: 1, todays_bookings: 3, todays_sessions: 2 },
          revenue: { daily: 1500, weekly: 6500, monthly: 25000, yearly: 260000 },
          package_sales: { weekly_credits_sold: 12, monthly_credits_sold: 50, weekly_pack_8_count: 2, weekly_pack_4_count: 1 },
          risk_preview: [],
          spotlight: { trainers: [], members: [] },
        })
      );
    }

    if (path === "/admin/trainers") return route.fulfill(json({ data: [] }));
    if (path === "/admin/members") return route.fulfill(json({ data: [] }));
    if (path === "/admin/bookings") return route.fulfill(json({ data: [] }));
    if (path === "/admin/settings") {
      return route.fulfill(
        json({
          data: {
            profile: {
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
        })
      );
    }

    return route.fulfill(json({ data: {} }));
  });
}

async function mockTrainerSurface(page: any) {
  await setE2EAuthCookies(page, "TRAINER");
  await page.route("**/api/**", async (route: any) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");

    if (path === "/auth/me") {
      return route.fulfill(
        json({
          data: {
            user: {
              id: "trainer-1",
              email: "trainer@demo.local",
              role: "TRAINER",
              tenantId: "tenant-1",
              tenantSlug: "demo",
            },
            available_surfaces: { web: true },
          },
        })
      );
    }

    if (path === "/trainer/today") {
      return route.fulfill(
        json({
          data: {
            date: "2026-03-05",
            summary: {
              booking_total: 1,
              pending_bookings: 1,
              approved_bookings: 0,
              session_total: 1,
              weekly_session_total: 4,
              member_total: 6,
              scheduled_sessions: 1,
              completed_sessions: 0,
              checkin_total: 0,
              deducted_credits_total: 0,
            },
            risk: { at_risk_count: 0, preview: [] },
            earnings: {
              month_gross_total: 10000,
              month_trainer_income: 2500,
              month_commission_rate: 25,
              month_credited_lessons: 5,
            },
            bookings: [],
            sessions: [],
            checkins: [],
          },
        })
      );
    }

    return route.fulfill(json({ data: {} }));
  });
}

test.describe("role surfaces", () => {
  test("admin dashboard renders core metrics", async ({ page }) => {
    await mockAdminSurface(page);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Klinik Yönetim Dashboard" })).toBeVisible();
    await expect(page.getByText("Aktif Eğitmen", { exact: true })).toBeVisible();
    await expect(page.getByText("Bugünkü Randevu", { exact: true })).toBeVisible();
    await expect(page.getByText("Günlük Kazanç", { exact: true })).toBeVisible();
  });

  test("trainer today renders empty states when lists are empty", async ({ page }) => {
    await mockTrainerSurface(page);

    await page.goto("/trainer/today");

    await expect(page.getByText("Eğitmen Operasyon Merkezi")).toBeVisible();
    await expect(page.getByText("Öncelikli risk danışanı bulunmuyor")).toBeVisible();
    await expect(page.getByText("Randevular")).toBeVisible();
  });
});
