import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { APP_STORE_URL, buildHomeJsonLd } from "@/components/home-page/content";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src: string }) => <img alt={alt || ""} src={src} />,
}));

describe("web home page", () => {
  it("keeps the clinic-management value proposition and primary routes visible", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fizyoflow mobil klinik yönetim platformu.");
    expect(screen.getByRole("link", { name: /iPhone için indir/ })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: "Demo" })).toHaveAttribute("href", "#demo");
    expect(screen.getByText("WhatsApp + Excel yerine Fizyoflow")).toBeInTheDocument();
    expect(screen.getByText("Gerçek ürün ekranları")).toBeInTheDocument();
  });

  it("publishes the expected organization, product, FAQ and canonical entities", () => {
    const jsonLd = buildHomeJsonLd();
    const graph = jsonLd["@graph"];

    expect(graph.map((entry) => entry["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
      "BreadcrumbList",
    ]);
    expect(graph[0]).toMatchObject({ name: "Fizyoflow", url: "https://fizyoflow.com" });
    expect(JSON.stringify(jsonLd)).toContain(APP_STORE_URL);
    expect(JSON.stringify(jsonLd)).toContain("Randevu ve seans takibi");
  });
});
