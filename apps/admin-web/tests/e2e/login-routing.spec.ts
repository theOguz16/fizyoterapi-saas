import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:2929";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function setE2EAuthCookies(page: any, role: "ADMIN" | "TRAINER" | "MEMBER", webEnabled = true) {
  await page.context().addCookies([
    { name: "e2e_role", value: role, url: baseURL },
    { name: "e2e_web_enabled", value: webEnabled ? "true" : "false", url: baseURL },
    { name: "e2e_user_id", value: `${role.toLowerCase()}-1`, url: baseURL },
    { name: "e2e_email", value: `${role.toLowerCase()}@demo.local`, url: baseURL },
    { name: "e2e_tenant_id", value: "tenant-1", url: baseURL },
    { name: "e2e_tenant_slug", value: "demo-salon", url: baseURL },
    { name: "e2e_full_name", value: `Demo ${role}`, url: baseURL },
  ]);
}

async function mockLoginFlow(page: any, options: { role?: "ADMIN" | "TRAINER" | "MEMBER"; webEnabled?: boolean }) {
  if (options.role) {
    await setE2EAuthCookies(page, options.role, options.webEnabled ?? true);
  }

  await page.route("**/api/**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");

    if (path === "/auth/login" && request.method() === "POST") {
      return route.fulfill(
        json({
          data: {
            user: options.role ? { role: options.role } : undefined,
            available_surfaces: { web: options.webEnabled ?? true },
          },
        })
      );
    }

    if (path === "/auth/me") {
      if (!options.role || options.webEnabled === false) {
        return route.fulfill(json({ data: {} }, 401));
      }

      return route.fulfill(
        json({
          data: {
            user: {
              id: `${options.role.toLowerCase()}-1`,
              email: `${options.role.toLowerCase()}@demo.local`,
              role: options.role,
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
          kpis: { active_trainers: 2, active_members: 10, at_risk_members: 1, todays_bookings: 3, todays_sessions: 2 },
          revenue: { daily: 1000, weekly: 5000, monthly: 20000, yearly: 240000 },
          package_sales: { weekly_credits_sold: 5, monthly_credits_sold: 20, weekly_pack_8_count: 1, weekly_pack_4_count: 1 },
          risk_preview: [],
          spotlight: { trainers: [], members: [] },
        })
      );
    }

    if (path === "/admin/trainers") {
      return route.fulfill(json({ data: [] }));
    }

    if (path === "/admin/settings") {
      return route.fulfill(json({ data: { profile: { business_hours: null } } }));
    }

    if (path === "/admin/bookings") {
      return route.fulfill(json({ data: [] }));
    }

    if (path === "/trainer/today") {
      return route.fulfill(
        json({
          data: {
            date: "2026-03-05",
            calendar: { business_hours: { timezone: "Europe/Istanbul", working_days: [1, 2, 3, 4, 5], start_time: "09:00", end_time: "18:00", lunch_break_start: "12:00", lunch_break_end: "13:00", slot_minutes: 30 } },
            summary: { booking_total: 1, pending_bookings: 1, approved_bookings: 0, session_total: 1, weekly_session_total: 4, member_total: 5, scheduled_sessions: 1, completed_sessions: 0, checkin_total: 0, deducted_credits_total: 0 },
            risk: { at_risk_count: 0, preview: [] },
            earnings: { month_gross_total: 10000, month_trainer_income: 2500, month_commission_rate: 25, month_credited_lessons: 5 },
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

test.describe("login routing", () => {
  test("renders the current login copy and policy icons", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
      if (path === "/auth/me") {
        return route.fulfill(json({ data: {} }, 401));
      }
      return route.fulfill(json({ data: {} }));
    });

    await page.goto("/login");

    await expect(page.getByText("Salon Operasyon Girişi")).toBeVisible();
    await expect(page.getByText("Bu panel yalnız yönetici ve eğitmen girişleri içindir.")).toBeVisible();
    await expect(page.locator("svg.lucide-shield-check")).toHaveCount(1);
  });

  test("blocks member login from admin-web", async ({ page }) => {
    await page.context().clearCookies();
    await mockLoginFlow(page, { role: "MEMBER", webEnabled: true });

    await page.goto("/login");
    await page.getByLabel("E-posta").fill("member@demo.local");
    await page.getByLabel("Şifre").fill("member123");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Üye girişi mobil uygulamada yapılır.")).toBeVisible();
  });

  test("routes admin login to dashboard", async ({ page }) => {
    await mockLoginFlow(page, { role: "ADMIN", webEnabled: true });

    await page.goto("/login");
    await page.getByLabel("E-posta").fill("admin@demo.local");
    await page.getByLabel("Şifre").fill("admin123");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("routes trainer login to trainer today", async ({ page }) => {
    await mockLoginFlow(page, { role: "TRAINER", webEnabled: true });

    await page.goto("/login");
    await page.getByLabel("E-posta").fill("trainer@demo.local");
    await page.getByLabel("Şifre").fill("trainer123");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page).toHaveURL(/\/trainer\/today$/);
  });

  test("blocks accounts without web surface access", async ({ page }) => {
    await mockLoginFlow(page, { role: "TRAINER", webEnabled: false });

    await page.goto("/login");
    await page.getByLabel("E-posta").fill("trainer@demo.local");
    await page.getByLabel("Şifre").fill("trainer123");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Bu hesap web paneline hazir degil. Once FizyoFlow onayini bekleyin.")).toBeVisible();
  });
});
