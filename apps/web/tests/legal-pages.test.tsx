import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KvkkPage from "../app/kvkk/page";
import PrivacyPage from "../app/gizlilik-politikasi/page";
import TermsPage from "../app/kullanim-sartlari/page";

describe("legal pages", () => {
  it("explains health-data minimization and retention in the KVKK notice", () => {
    render(<KvkkPage />);

    expect(screen.getByRole("heading", { name: "KVKK Aydınlatma Metni" })).toBeInTheDocument();
    expect(screen.getByText(/Klinik keşfi sırasında belirti, tanı veya sağlık geçmişi istenmez/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saklama Süreleri" })).toBeInTheDocument();
    expect(screen.getByText(/2026-07-16/)).toBeInTheDocument();
  });

  it("states that notice acknowledgement and marketing are separate", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/aydınlatma metnini okuduğunuzu belirtmeniz açık rıza verdiğiniz anlamına gelmez/i)).toBeInTheDocument();
    expect(screen.getByText(/Pazarlama iletişimini reddetmeniz hesap açmanızı/i)).toBeInTheDocument();
  });

  it("links terms to both privacy documents", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute("href", "/kvkk");
    expect(screen.getByRole("link", { name: "Gizlilik Politikası" })).toHaveAttribute("href", "/gizlilik-politikasi");
  });
});
