"use client";

import { FormEvent, useState } from "react";
import { getPublicAttribution, trackPublicEvent } from "./public-event";

type Props = {
  slug: string;
  apiBase: string;
  quickContactHref?: string;
  quickContactLabel?: string;
};
const LEAD_TIMEOUT_MS = 7000;

export function LeadForm({ slug, apiBase, quickContactHref, quickContactLabel = "WhatsApp'tan yazın" }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setMessageType("success");

    const formData = new FormData(form);
    if (String(formData.get("website") || "").trim()) {
      setBusy(false);
      return;
    }
    const payload = {
      full_name: String(formData.get("full_name") || ""),
      phone: String(formData.get("phone") || ""),
      interest: String(formData.get("interest") || ""),
      availability_note: String(formData.get("availability_note") || ""),
      consent: formData.get("consent") === "on",
      source: "clinic-lead-form",
      attribution: getPublicAttribution(),
      page_path: typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`,
    };

    if (formData.get("consent") !== "on") {
      setBusy(false);
      setMessageType("error");
      setMessage("Bilgi talebi için aydınlatma metni onayı gereklidir.");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LEAD_TIMEOUT_MS);
    try {
      const response = await fetch(`${apiBase}/public/salons/${slug}/leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
      if (!response.ok) {
        setMessageType("error");
        setMessage(json.error?.message || "Talebiniz şu an alınamadı. Lütfen birazdan tekrar deneyin.");
        return;
      }
      setMessageType("success");
      setMessage(json.message || "Talebiniz başarıyla alındı. Ekibimiz size kısa sürede dönüş yapacak.");
      void trackPublicEvent(apiBase, slug, "LEAD_SUBMIT", "lead-form");
      form.reset();
    } catch (error) {
      setMessageType("error");
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("İstek zaman aşımına uğradı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      } else {
        setMessage("Sunucuya ulaşılamadı. Lütfen kısa süre sonra tekrar deneyin.");
      }
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <form className="grid" onSubmit={submit}>
      <input className="form-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="form-field">
        <span>Ad Soyad</span>
        <input name="full_name" placeholder="Örn. Ayşe Yılmaz" required autoComplete="name" />
      </label>
      <label className="form-field">
        <span>Telefon</span>
        <input name="phone" placeholder="05xx xxx xx xx" required inputMode="tel" autoComplete="tel" />
      </label>
      <label className="form-field">
        <span>İlgilendiğiniz hizmet</span>
        <input name="interest" placeholder="Bel-boyun, klinik pilates, rehabilitasyon..." />
      </label>
      <label className="form-field">
        <span>Kısa not</span>
        <textarea name="availability_note" rows={4} placeholder="Uygun olduğunuz gün/saat veya ihtiyacınız" />
      </label>
      <label className="consent-row">
        <input name="consent" type="checkbox" required />
        <span>
          Bilgilerimin kliniğin bana dönüş yapması için işlenmesini kabul ediyorum. Fizyoflow{" "}
          <a href="https://fizyoflow.com/kvkk" target="_blank" rel="noreferrer">KVKK</a> ve{" "}
          <a href="https://fizyoflow.com/gizlilik-politikasi" target="_blank" rel="noreferrer">gizlilik</a> metinlerini okuyabilirim.
        </span>
      </label>
      <button type="submit" disabled={busy}>{busy ? "Gönderiliyor..." : "Bilgi Talebi Gönder"}</button>
      <p className="form-note">Bu form tanı veya tedavi başvurusu değildir; bilgileriniz yalnızca ilgili kliniğin size dönüş yapması için kullanılır.</p>
      {message ? <p className={`small ${messageType === "error" ? "error-text" : "success-text"}`}>{message}</p> : null}
      {message && messageType === "success" ? (
        <div className="lead-next-step">
          <strong>Sonraki adım</strong>
          <span>Klinik ekibi uygun zaman ve hizmet bilgisiyle size döner.</span>
          {quickContactHref ? <a href={quickContactHref}>{quickContactLabel}</a> : null}
        </div>
      ) : null}
    </form>
  );
}
