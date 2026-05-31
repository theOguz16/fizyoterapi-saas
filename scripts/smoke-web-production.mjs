const WEB_BASE = (process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
const API_BASE = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || "https://api.fizyoflow.com/api").replace(/\/$/, "");
const ADMIN_BASE = (process.env.ADMIN_BASE_URL || "https://app.fizyoflow.com").replace(/\/$/, "");
const PUBLIC_SLUG = process.env.PUBLIC_SMOKE_SLUG || "atlasfizyo";
const SUBMIT_LEADS = process.env.WEB_SMOKE_SUBMIT_LEADS === "1";

async function check(name, fn) {
  const startedAt = Date.now();
  await fn();
  console.log(JSON.stringify({ event: "web_smoke_step_passed", step: name, duration_ms: Date.now() - startedAt }));
}

async function expectStatus(url, expected = 200) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== expected) {
    throw new Error(`${url} returned ${response.status}, expected ${expected}`);
  }
  return response;
}

async function expectHtmlIncludes(url, expectedTexts) {
  const response = await expectStatus(url);
  const html = await response.text();
  for (const expectedText of expectedTexts) {
    if (!html.includes(expectedText)) {
      throw new Error(`${url} is missing expected text: ${expectedText}`);
    }
  }
}

async function postJson(url, body, expectedStatuses = [200, 201, 202]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "fizyoflow-web-smoke/1.0" },
    body: JSON.stringify(body),
  });
  if (!expectedStatuses.includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new Error(`${url} returned ${response.status}, expected ${expectedStatuses.join("/")} ${text.slice(0, 180)}`);
  }
  return response;
}

async function main() {
  await check("api_health", () => expectStatus(`${API_BASE.replace(/\/api$/, "")}/health`));
  await check("web_home", () =>
    expectHtmlIncludes(WEB_BASE, [
      "Fizyoflow",
      "Satın alma nedeni",
      "Paket beklentisi",
      "Büyüme ölçümü",
      "Kurulum bilgileri",
      "Canlıya hazır mı?",
      "Demo Talep Et",
    ])
  );
  await check("admin_login", () => expectHtmlIncludes(`${ADMIN_BASE}/login`, ["Giriş"]));
  await check("sitemap", () => expectStatus(`${WEB_BASE}/sitemap.xml`));
  await check("robots", () => expectStatus(`${WEB_BASE}/robots.txt`));
  await check("thanks_page", () => expectHtmlIncludes(`${WEB_BASE}/tesekkurler`, ["Demo talebi alındı", "Hazırlık için"]));
  await check("public_clinic", () =>
    expectHtmlIncludes(`${new URL(WEB_BASE).protocol}//${PUBLIC_SLUG}.${new URL(WEB_BASE).hostname.replace(/^www\./, "")}`, [
      "Fizyoflow",
      "Bilgi ve Randevu Talebi",
      "Dijital Güven",
    ])
  );
  await check("join_redirect_page", () => expectHtmlIncludes(`${WEB_BASE}/join/${PUBLIC_SLUG}?code=FYF-SMOKE`, ["Klinik daveti"]));
  await check("public_event", async () => {
    await postJson(`${API_BASE}/public/salons/${PUBLIC_SLUG}/events`, {
      event_type: "PAGE_VIEW",
      source: "production-smoke",
      page_path: "/",
    });
  });
  if (SUBMIT_LEADS) {
    const suffix = Date.now().toString().slice(-8);
    await check("demo_lead_submit", () =>
      postJson(`${API_BASE}/public/demo-leads`, {
        full_name: "Web Smoke",
        clinic_name: "Fizyoflow Smoke Clinic",
        phone: `90555${suffix}`,
        city: "Istanbul",
        note: "Production smoke test",
        website: "",
        consent: true,
      })
    );
    await check("clinic_lead_submit", () =>
      postJson(`${API_BASE}/public/salons/${PUBLIC_SLUG}/leads`, {
        full_name: "Clinic Smoke",
        phone: `90556${suffix}`,
        interest: "Smoke test",
        availability_note: "Production smoke test",
        consent: true,
      })
    );
    await check("clinic_lead_event", () =>
      postJson(`${API_BASE}/public/salons/${PUBLIC_SLUG}/events`, {
        event_type: "LEAD_SUBMIT",
        source: "production-smoke",
        page_path: "/",
      })
    );
  }
  console.log(JSON.stringify({ event: "web_smoke_passed", web_base: WEB_BASE, api_base: API_BASE, public_slug: PUBLIC_SLUG, submitted_leads: SUBMIT_LEADS }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "web_smoke_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
