import { expect, test, type Page } from "@playwright/test";
import { APP_STORE_URL, screenGroups } from "../../components/home-page/content";

const roleNames = ["Klinik", "Uzman", "Danışan"];
const pageSectionSelectors = [
  ".product-hero",
  ".product-explain-section",
  ".comparison-section",
  ".operational-flow-section",
  ".product-screens-section",
  ".product-trust-section",
  ".product-faq-section",
  ".product-demo-section",
  ".product-footer",
];

async function expectResponsiveGallery(page: Page, layout: "desktop" | "mobile") {
  const groups = page.locator(".role-screen-group");
  await expect(groups).toHaveCount(3);
  await expect(groups.locator(".role-screen-heading > span")).toHaveText(roleNames);

  for (let index = 0; index < 3; index += 1) {
    const group = groups.nth(index);
    const row = group.locator(".role-screen-row");
    const items = row.locator(".screen-item");
    await expect(items).toHaveCount(6);

    const layoutState = await group.evaluate((element) => {
      const heading = element.querySelector<HTMLElement>(".role-screen-heading");
      const galleryRow = element.querySelector<HTMLElement>(".role-screen-row");
      if (!heading || !galleryRow) throw new Error("Rol galerisi yerleşim elemanları bulunamadı.");
      const headingRect = heading.getBoundingClientRect();
      const rowRect = galleryRow.getBoundingClientRect();
      return {
        headingRight: headingRect.right,
        headingBottom: headingRect.bottom,
        rowLeft: rowRect.left,
        rowTop: rowRect.top,
        rowWidth: rowRect.width,
        rowScrollWidth: galleryRow.scrollWidth,
      };
    });

    expect(layoutState.rowScrollWidth).toBeGreaterThan(layoutState.rowWidth);
    if (layout === "desktop") {
      expect(layoutState.headingRight).toBeLessThanOrEqual(layoutState.rowLeft + 1);
    } else {
      expect(layoutState.headingBottom).toBeLessThanOrEqual(layoutState.rowTop + 1);
    }

    const scrollState = await row.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      const lastItem = element.querySelector<HTMLElement>(".screen-item:last-child");
      if (!lastItem) throw new Error("Son galeri ekranı bulunamadı.");
      const rowRect = element.getBoundingClientRect();
      const itemRect = lastItem.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rowRect.right, itemRect.right) - Math.max(rowRect.left, itemRect.left));
      return {
        scrollLeft: element.scrollLeft,
        maxScrollLeft: element.scrollWidth - element.clientWidth,
        horizontalVisibility: visibleWidth / itemRect.width,
      };
    });
    expect(scrollState.scrollLeft).toBeGreaterThanOrEqual(scrollState.maxScrollLeft - 1);
    expect(scrollState.horizontalVisibility).toBeGreaterThan(0.95);
  }

  const overflow = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

test.describe("public marketing site", () => {
  test("home page exposes the product promise and demo entry point", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/FizyoFlow \| Mobil Klinik Yönetim Platformu/);
    await expect(
      page.getByRole("heading", { level: 1, name: /FizyoFlow mobil klinik yönetim platformu/ })
    ).toBeVisible();
    await expect(page.getByText("6 temel operasyon, tek akış")).toHaveCount(0);
    await expect(page.getByText("Klinik, uzman ve danışan ekranları")).toHaveCount(0);
    await expect(page.getByText("15 dakikalık ürün demosu")).toHaveCount(0);
    await expect(page.getByText("Operasyon görünümü", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sahada danışan dosyası", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Kalan hak ve ölçüm", { exact: true })).toHaveCount(0);
    await expect(page.locator(".product-proof")).toHaveCount(0);
    await expect(page.locator(".featured-screens")).toHaveCount(0);
    await expect(page.locator(".featured-screen-card")).toHaveCount(0);
    await expect(page.locator(".role-screen-group")).toHaveCount(3);
    for (const group of await page.locator(".role-screen-group").all()) {
      await expect(group.locator(".screen-item")).toHaveCount(6);
    }

    const sectionPositions = await pageSectionSelectors.reduce<Promise<number[]>>(async (positionsPromise, selector) => {
      const positions = await positionsPromise;
      const position = await page.locator(selector).evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
      return [...positions, position];
    }, Promise.resolve([]));
    expect(sectionPositions).toEqual([...sectionPositions].sort((a, b) => a - b));

    await page.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(page).toHaveURL(/#demo$/);
    await expect(page.locator("#demo")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Demo Talep Et" })).toBeVisible();

    await expect(page.getByRole("link", { name: "15 dakikalık demo talep et" })).toHaveAttribute("href", "#demo");
    await expect(page.getByRole("link", { name: "Kliniğini kur" })).toHaveAttribute("href", APP_STORE_URL);
    await expect(page.getByRole("link", { name: "FizyoFlow ana sayfa" }).first()).toHaveAttribute("href", "/");
  });

  test("role galleries stay aligned and horizontally scrollable on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.locator("#urun").scrollIntoViewIfNeeded();

    await expectResponsiveGallery(page, "desktop");
  });

  test("role galleries keep all screens and page width intact on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("#urun").scrollIntoViewIfNeeded();

    await expectResponsiveGallery(page, "mobile");
  });

  test("all active gallery images are directly available", async ({ request }) => {
    for (const group of screenGroups) {
      expect(group.screens).toHaveLength(6);
      for (const screen of group.screens) {
        const response = await request.get(screen.image);
        expect(response.status(), `${screen.image} HTTP durumu`).toBe(200);
        expect(response.headers()["content-type"], `${screen.image} içerik türü`).toContain("image/png");
      }
    }
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
