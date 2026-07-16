import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JoinRedirectClient } from "@/app/join/[salonSlug]/join-redirect-client";
import { buildJoinDeepLink, resolveJoinRedirect, resolveJoinStoreUrl } from "@/lib/join-redirect";

describe("clinic join redirect", () => {
  it("encodes the clinic slug in the mobile deep link", () => {
    expect(buildJoinDeepLink(" Test-Klinik ")).toBe("fizyoflow://join/test-klinik");
    expect(buildJoinDeepLink(" Test-Klinik ", "FYF-DEMO_001")).toBe(
      "fizyoflow://join/test-klinik?code=FYF-DEMO_001"
    );
    expect(buildJoinDeepLink(" Test-Klinik ", "unsafe code/value")).toBe("fizyoflow://join/test-klinik");
  });

  it("uses configured stores and falls back to the deep link when absent", () => {
    expect(resolveJoinRedirect({
      salonSlug: " test-klinik ",
      salonCode: " FYF-DEMO-001 ",
      iosStoreUrl: " https://apps.apple.com/tr/app/fizyoflow/id6771870032 ",
      androidStoreUrl: " https://play.google.com/store/apps/details?id=com.fizyoflow.mobile ",
    })).toEqual({
      salonSlug: "test-klinik",
      salonCode: "FYF-DEMO-001",
      deepLink: "fizyoflow://join/test-klinik?code=FYF-DEMO-001",
      iosStoreUrl: "https://apps.apple.com/tr/app/fizyoflow/id6771870032",
      androidStoreUrl: "https://play.google.com/store/apps/details?id=com.fizyoflow.mobile",
    });
    expect(resolveJoinRedirect({ salonSlug: "test-klinik" }).iosStoreUrl).toBe(
      "fizyoflow://join/test-klinik"
    );
    expect(resolveJoinRedirect({
      salonSlug: "test-klinik",
      iosStoreUrl: "javascript:alert(1)",
      androidStoreUrl: "https://example.com/not-the-play-store",
    })).toEqual(expect.objectContaining({
      iosStoreUrl: "fizyoflow://join/test-klinik",
      androidStoreUrl: "fizyoflow://join/test-klinik",
    }));
  });

  it("selects Android only for Android user agents and preserves manual actions", () => {
    expect(resolveJoinStoreUrl("Mozilla Android", "ios", "android")).toBe("android");
    expect(resolveJoinStoreUrl("Mozilla iPhone", "ios", "android")).toBe("ios");

    const html = renderToStaticMarkup(
      <JoinRedirectClient
        salonSlug="test-klinik"
        salonCode="ABC123"
        deepLink="fizyoflow://join/test-klinik?code=ABC123"
        iosStoreUrl="https://apps.apple.com/tr/app/fizyoflow/id6771870032"
        androidStoreUrl="https://play.google.com/store/apps/details?id=com.fizyoflow.mobile"
      />
    );
    expect(html).toContain("Uygulamayı Aç");
    expect(html).toContain("Salon: test-klinik");
    expect(html).toContain("Davet kodu bağlantıya eklendi");
    expect(html).not.toContain("Kod: ABC123");
  });
});
