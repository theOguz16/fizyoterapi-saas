import { expect, test } from "@playwright/test";

test.describe("public marketing site", () => {
  test("home page exposes the product promise and demo entry point", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/FizyoFlow \| Mobil Klinik Yönetim Platformu/);
    await expect(
      page.getByRole("heading", { level: 1, name: /FizyoFlow mobil klinik yönetim platformu/ })
    ).toBeVisible();
    await expect(page.getByText("6 temel operasyon, tek akış")).toBeVisible();

    await page.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(page.locator("#demo")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Demo Talep Et" })).toBeVisible();
  });

  test("footer legal links navigate to substantive legal pages", async ({ page }) => {
    await page.goto("/");

    await page.locator("footer").getByRole("link", { name: "Gizlilik" }).click();
    await expect(page).toHaveURL(/\/gizlilik-politikasi$/);
    await expect(page.getByRole("heading", { level: 1, name: "Fizyoflow Gizlilik Politikası" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Veri saklama politikası" })).toBeVisible();

    await page.getByRole("link", { name: "Fizyoflow ana sayfa" }).click();
    await page.locator("footer").getByRole("link", { name: "KVKK", exact: true }).click();
    await expect(page).toHaveURL(/\/kvkk$/);
    await expect(page.getByRole("heading", { level: 1, name: "KVKK Aydınlatma Metni" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Haklarınız" })).toBeVisible();

    await page.getByRole("link", { name: "Fizyoflow ana sayfa" }).click();
    await page.locator("footer").getByRole("link", { name: "Kullanım Şartları" }).click();
    await expect(page).toHaveURL(/\/kullanim-sartlari$/);
    await expect(page.getByRole("heading", { level: 1, name: "Kullanım Şartları" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sağlık Bilgilendirmesi" })).toBeVisible();
  });

  test("demo form validates consent and submits an intercepted lead without external effects", async ({ page }) => {
    let interceptedPayload: Record<string, unknown> | undefined;
    let interceptedRequests = 0;

    await page.route("**/api/public/demo-leads", async (route) => {
      interceptedRequests += 1;
      interceptedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Test demo talebi alındı." }),
      });
    });

    await page.goto("/?utm_source=playwright&utm_campaign=public-smoke#demo");
    const form = page.locator("#demo form");
    await form.getByLabel("Ad", { exact: true }).fill("Ayşe");
    await form.getByLabel("Soyad", { exact: true }).fill("Yılmaz");
    await form.getByLabel("Klinik").fill("Örnek Fizyo");
    await form.getByLabel("Telefon").fill("0555 123 45 67");
    await form.getByLabel("E-posta").fill("ayse@example.com");

    await form.getByRole("button", { name: "Demo Talep Et" }).click();
    await expect(form.getByRole("checkbox")).toHaveJSProperty("validity.valueMissing", true);
    expect(interceptedRequests).toBe(0);

    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Demo Talep Et" }).click();

    await expect(form.getByText("Test demo talebi alındı.")).toBeVisible();
    await expect(form.getByText("Görüşmede netleşecekler")).toBeVisible();
    expect(interceptedRequests).toBe(1);
    expect(interceptedPayload).toMatchObject({
      full_name: "Ayşe Yılmaz",
      clinic_name: "Örnek Fizyo",
      email: "ayse@example.com",
      phone: "0555 123 45 67",
      consent: true,
      attribution: "utm_source:playwright|utm_campaign:public-smoke",
      page_path: "/?utm_source=playwright&utm_campaign=public-smoke",
    });

    await expect(page).toHaveURL(/\/tesekkurler\?source=demo$/);
    await expect(page.getByText("Demo talebi alındı", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/net bir başlangıç planı/i);
  });
});
