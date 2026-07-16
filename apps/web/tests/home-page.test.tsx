import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { APP_STORE_URL, buildHomeJsonLd, screenGroups } from "@/components/home-page/content";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src: string }) => <img alt={alt || ""} src={src} />,
}));

describe("web home page", () => {
  it("keeps the clinic-management value proposition and primary routes visible", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FizyoFlow mobil klinik yönetim platformu.");
    expect(screen.getByText("Fizyoterapi ve pilates kliniği sahipleri için")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "15 dakikalık demo talep et" })).toHaveAttribute("href", "#demo");
    expect(screen.getByRole("link", { name: "Kliniğini kur" })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: "Demo" })).toHaveAttribute("href", "#demo");
    expect(screen.getByText("6 temel operasyon, tek akış")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp + Excel yerine FizyoFlow")).toBeInTheDocument();
    expect(screen.getByText("Gerçek ürün ekranları")).toBeInTheDocument();
    expect(screenGroups).toHaveLength(3);
    expect(screenGroups.every((group) => group.screens.length === 2)).toBe(true);
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
    expect(graph[0]).toMatchObject({ name: "FizyoFlow", url: "https://fizyoflow.com" });
    expect(JSON.stringify(jsonLd)).toContain(APP_STORE_URL);
    expect(JSON.stringify(jsonLd)).toContain("Randevu ve seans takibi");
  });
});
