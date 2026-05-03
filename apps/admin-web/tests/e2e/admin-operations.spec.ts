import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:2929";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function setAdminCookies(page: any) {
  await page.context().addCookies([
    { name: "e2e_role", value: "ADMIN", url: baseURL },
    { name: "e2e_web_enabled", value: "true", url: baseURL },
    { name: "e2e_user_id", value: "admin-1", url: baseURL },
    { name: "e2e_email", value: "admin@demo.local", url: baseURL },
    { name: "e2e_tenant_id", value: "tenant-1", url: baseURL },
    { name: "e2e_tenant_slug", value: "demo-salon", url: baseURL },
    { name: "e2e_full_name", value: "Demo Admin", url: baseURL },
  ]);
}

async function mockAdminOperations(page: any) {
  await setAdminCookies(page);
  await page.route("**/api/**", async (route: any) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");

    if (path === "/auth/me") {
      return route.fulfill(
        json({
          data: {
            user: {
              id: "admin-1",
              email: "admin@demo.local",
              role: "ADMIN",
              tenantId: "tenant-1",
              tenantSlug: "demo-salon",
            },
            available_surfaces: { web: true },
          },
        })
      );
    }

    if (path === "/admin/invites" && method === "GET") {
      return route.fulfill(
        json({
          data: [
            {
              id: "invite-1",
              role: "TRAINER",
              email_or_phone: "trainer@demo.local",
              status: "PENDING",
              expires_at: "2026-03-08T10:00:00.000Z",
              created_at: "2026-03-05T10:00:00.000Z",
            },
          ],
        })
      );
    }

    if (path === "/admin/invites/invite-1/cancel" && method === "PATCH") {
      return route.fulfill(json({ data: { ok: true } }));
    }

    if (path.startsWith("/admin/referrals") && method === "GET") {
      if (path === "/admin/referrals/rewards/list") {
        return route.fulfill(
          json({
            data: [
              {
                id: "reward-1",
                referral_id: "ref-1",
                member_id: "member-1",
                credits_granted: 2,
                rule_name: "Hos geldin",
                granted_at: "2026-03-05T10:00:00.000Z",
                created_at: "2026-03-05T10:00:00.000Z",
              },
            ],
          })
        );
      }

      if (path === "/admin/referrals/ref-1") {
        return route.fulfill(
          json({
            data: {
              referral: {
                id: "ref-1",
                inviter_member_id: "member-1",
                invitee_phone_or_email: "friend@demo.local",
                code: "REF100",
                status: "CONVERTED",
                created_at: "2026-03-05T10:00:00.000Z",
              },
              rewards: [],
            },
          })
        );
      }

      return route.fulfill(
        json({
          data: [
            {
              id: "ref-1",
              inviter_member_id: "member-1",
              invitee_phone_or_email: "friend@demo.local",
              code: "REF100",
              status: "CONVERTED",
              created_at: "2026-03-05T10:00:00.000Z",
            },
          ],
        })
      );
    }

    if (path === "/admin/referrals/ref-1/grant-reward" && method === "POST") {
      return route.fulfill(json({ data: { ok: true } }));
    }

    return route.fulfill(json({ data: {} }));
  });
}

test.describe("admin operations", () => {
  test("pending invite can be canceled from admin-web", async ({ page }) => {
    await mockAdminOperations(page);

    await page.goto("/admin/invites");
    await expect(page.getByRole("heading", { name: "Davet Yönetimi" })).toBeVisible();

    const cancelRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/invites/invite-1/cancel") && resp.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "İptal" }).click();
    const response = await cancelRequest;
    expect(response.status()).toBe(200);
  });

  test("converted referral detail can grant reward", async ({ page }) => {
    await mockAdminOperations(page);

    await page.goto("/admin/referrals");
    await expect(page.getByRole("heading", { name: "Referans ve Ödül Yönetimi" })).toBeVisible();
    await expect(page.getByText("REF100")).toBeVisible();

    const rewardRequest = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/referrals/ref-1/grant-reward") && resp.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Ödül Ver" }).click();
    const response = await rewardRequest;
    expect(response.status()).toBe(200);
  });
});
