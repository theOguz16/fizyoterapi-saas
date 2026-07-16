"use client";

import { FormEvent, useState } from "react";
import { trackMarketingEvent } from "./site-analytics";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4949/api";
const DEMO_TIMEOUT_MS = 7000;

function getAttribution() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .map((key) => [key, params.get(key)] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
    .slice(0, 160);
}

export function DemoLeadForm({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageType("success");

    const form = event.currentTarget;
    const data = new FormData(form);
    const firstName = String(data.get("first_name") || "").trim();
    const lastName = String(data.get("last_name") || "").trim();
    const fullName = String(data.get("full_name") || "").trim() || [firstName, lastName].filter(Boolean).join(" ");
    const payload = {
      full_name: fullName,
      clinic_name: String(data.get("clinic_name") || ""),
      email: String(data.get("email") || ""),
      phone: String(data.get("phone") || ""),
      city: String(data.get("city") || ""),
      clinic_type: String(data.get("clinic_type") || ""),
      primary_need: String(data.get("primary_need") || ""),
      note: String(data.get("note") || ""),
      website: String(data.get("website") || ""),
      consent: data.get("consent") === "on",
      attribution: getAttribution(),
      page_path: typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`,
    };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), DEMO_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/public/demo-leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
      if (!response.ok) {
        setMessageType("error");
        setMessage(json.error?.message || "Demo talebiniz alınamadı. Lütfen tekrar deneyin.");
        return;
      }
      trackMarketingEvent("demo_lead_submit", {
        source: "product_site",
        city: payload.city || undefined,
      });
      setMessageType("success");
      setMessage(json.message || "Demo talebiniz alındı. Size kısa sürede dönüş yapacağız.");
      form.reset();
      window.setTimeout(() => {
        window.location.assign("/tesekkurler?source=demo");
      }, 650);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "İstek zaman aşımına uğradı. İnternet bağlantınızı kontrol edip tekrar deneyin."
          : "Sunucuya ulaşılamadı. Lütfen kısa süre sonra tekrar deneyin."
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <form className="demo-lead-form" onSubmit={submit}>
      <input className="form-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="form-field">
        <span>Ad</span>
        <input name="first_name" placeholder="Adınız" required autoComplete="given-name" />
      </label>
      <label className="form-field">
        <span>Soyad</span>
        <input name="last_name" placeholder="Soyadınız" required autoComplete="family-name" />
      </label>
      <label className="form-field">
        <span>Klinik</span>
        <input name="clinic_name" placeholder="Klinik adınız" required autoComplete="organization" />
      </label>
      <label className="form-field">
        <span>Telefon</span>
        <input name="phone" placeholder="05xx xxx xx xx" required inputMode="tel" autoComplete="tel" />
      </label>
      <label className="form-field wide">
        <span>E-posta</span>
        <input name="email" type="email" placeholder="ornek@klinik.com" required autoComplete="email" />
      </label>
      {!compact ? (
        <>
          <label className="form-field">
            <span>Şehir / İlçe</span>
            <input name="city" placeholder="Kadıköy, İstanbul" autoComplete="address-level2" />
          </label>
          <label className="form-field">
            <span>Klinik tipi</span>
            <select name="clinic_type" defaultValue="">
              <option value="" disabled>Seçin</option>
              <option value="Fizyoterapi kliniği">Fizyoterapi kliniği</option>
              <option value="Klinik pilates hizmeti veren merkez">Klinik pilates hizmeti veren merkez</option>
              <option value="Rehabilitasyon merkezi">Rehabilitasyon merkezi</option>
              <option value="Hareket / sağlık merkezi">Hareket / sağlık merkezi</option>
            </select>
          </label>
          <label className="form-field">
            <span>Öncelikli ihtiyaç</span>
            <select name="primary_need" defaultValue="">
              <option value="" disabled>Seçin</option>
              <option value="Seans ve takvim düzeni">Seans ve takvim düzeni</option>
              <option value="Paket ve kalan hak takibi">Paket ve kalan hak takibi</option>
              <option value="Uzman check-in akışı">Uzman check-in akışı</option>
              <option value="Danışan mobil deneyimi">Danışan mobil deneyimi</option>
              <option value="Tüm klinik operasyonu">Tüm klinik operasyonu</option>
            </select>
          </label>
          <label className="form-field wide">
            <span>Kısa not</span>
            <textarea name="note" rows={3} placeholder="Bugün en çok zaman alan takip işinizi kısaca yazın" />
          </label>
        </>
      ) : null}
      <label className="consent-row wide">
        <input name="consent" type="checkbox" required />
        <span>
          Demo talebim için iletişim bilgilerimin işlenmesini kabul ediyorum. Detaylar için{" "}
          <a href="/kvkk" target="_blank" rel="noreferrer">KVKK</a> ve{" "}
          <a href="/gizlilik-politikasi" target="_blank" rel="noreferrer">gizlilik metinlerini</a> okuyabilirsiniz.
        </span>
      </label>
      <button type="submit" disabled={busy}>{busy ? "Gönderiliyor..." : "Demo Talep Et"}</button>
      {message ? <p className={`small ${messageType === "error" ? "error-text" : "success-text"}`}>{message}</p> : null}
      {message && messageType === "success" ? (
        <div className="lead-next-step wide">
          <strong>Görüşmede netleşecekler</strong>
          <span>Seans, paket, check-in ve danışan takip akışınız birlikte çıkarılır.</span>
        </div>
      ) : null}
    </form>
  );
}
