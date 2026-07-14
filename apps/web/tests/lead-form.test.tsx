import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadForm } from "@/components/lead-form";

describe("clinic lead form", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/test-klinik?utm_source=instagram");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: "Talebiniz alındı." }),
    }));
  });

  it("requires consent before sending a lead", () => {
    render(<LeadForm slug="test-klinik" apiBase="https://api.example.com/api" />);

    fireEvent.submit(screen.getByRole("button", { name: "Bilgi Talebi Gönder" }).closest("form")!);

    expect(screen.getByText("Bilgi talebi için aydınlatma metni onayı gereklidir.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the lead payload, attribution and shows the next action", async () => {
    const user = userEvent.setup();
    render(
      <LeadForm
        slug="test-klinik"
        apiBase="https://api.example.com/api"
        quickContactHref="https://wa.me/905551234567"
      />
    );

    await user.type(screen.getByLabelText("Ad Soyad"), "Ayşe Yılmaz");
    await user.type(screen.getByLabelText("Telefon"), "0555 123 45 67");
    await user.type(screen.getByLabelText("İlgilendiğiniz hizmet"), "Klinik pilates");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Bilgi Talebi Gönder" }));

    await waitFor(() => expect(screen.getByText("Talebiniz alındı.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "WhatsApp'tan yazın" })).toHaveAttribute(
      "href",
      "https://wa.me/905551234567"
    );
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/public/salons/test-klinik/leads",
      expect.objectContaining({ method: "POST" })
    );
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      full_name: "Ayşe Yılmaz",
      phone: "0555 123 45 67",
      interest: "Klinik pilates",
      consent: true,
      source: "clinic-lead-form",
      attribution: "utm_source:instagram",
      page_path: "/test-klinik?utm_source=instagram",
    });
  });
});
