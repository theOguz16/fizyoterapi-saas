import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JoinRedirectClient } from "@/app/join/[salonSlug]/join-redirect-client";
import { buildJoinDeepLink, resolveJoinRedirect, resolveJoinStoreUrl } from "@/lib/join-redirect";

describe("clinic join redirect", () => {
  it("encodes the clinic slug in the mobile deep link", () => {
    expect(buildJoinDeepLink(" test klinik/istanbul ")).toBe(
      "fizyoflow://(intake-member)/salons/test%20klinik%2Fistanbul"
    );
  });

  it("uses configured stores and falls back to the deep link when absent", () => {
    expect(resolveJoinRedirect({
      salonSlug: " test-klinik ",
      iosStoreUrl: " https://apps.apple.com/test ",
      androidStoreUrl: " https://play.google.com/test ",
    })).toEqual({
      salonSlug: "test-klinik",
      deepLink: "fizyoflow://(intake-member)/salons/test-klinik",
      iosStoreUrl: "https://apps.apple.com/test",
      androidStoreUrl: "https://play.google.com/test",
    });
    expect(resolveJoinRedirect({ salonSlug: "test-klinik" }).iosStoreUrl).toBe(
      "fizyoflow://(intake-member)/salons/test-klinik"
    );
  });

  it("selects Android only for Android user agents and preserves manual actions", () => {
    expect(resolveJoinStoreUrl("Mozilla Android", "ios", "android")).toBe("android");
    expect(resolveJoinStoreUrl("Mozilla iPhone", "ios", "android")).toBe("ios");

    const html = renderToStaticMarkup(
      <JoinRedirectClient
        salonSlug="test-klinik"
        salonCode="ABC123"
        deepLink="fizyoflow://(intake-member)/salons/test-klinik"
        iosStoreUrl="https://apps.apple.com/test"
        androidStoreUrl="https://play.google.com/test"
      />
    );
    expect(html).toContain("Uygulamayı Aç");
    expect(html).toContain("Salon: test-klinik");
    expect(html).toContain("Kod: ABC123");
  });
});
