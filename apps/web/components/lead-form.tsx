"use client";

import { FormEvent, useState } from "react";

type Props = {
  slug: string;
  apiBase: string;
};
const LEAD_TIMEOUT_MS = 7000;

export function LeadForm({ slug, apiBase }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageType("success");

    const formData = new FormData(event.currentTarget);
    const payload = {
      full_name: String(formData.get("full_name") || ""),
      phone: String(formData.get("phone") || ""),
      interest: String(formData.get("interest") || ""),
      availability_note: String(formData.get("availability_note") || ""),
    };

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
      event.currentTarget.reset();
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
      <input name="full_name" placeholder="Ad Soyad" required />
      <input name="phone" placeholder="Telefon" required />
      <input name="interest" placeholder="İlgi Alanı (örn. Skolyoz, Pilates)" />
      <textarea name="availability_note" rows={4} placeholder="Uygun olduğunuz gün/saat bilgisi" />
      <button type="submit" disabled={busy}>{busy ? "Gönderiliyor..." : "Bilgi Talebi Gönder"}</button>
      {message ? <p className={`small ${messageType === "error" ? "error-text" : "success-text"}`}>{message}</p> : null}
    </form>
  );
}
