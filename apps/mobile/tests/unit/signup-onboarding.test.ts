import { describe, expect, it } from "vitest";
import {
  createSyntheticSignupOnboarding,
  getDefaultSignupProfile,
  mapSignupProfileToMemberIntentDefaults,
  summarizeSignupOnboarding,
} from "@/lib/signup-onboarding";

describe("signup onboarding helpers", () => {
  it("creates deterministic synthetic profiles from the same seed", () => {
    const first = createSyntheticSignupOnboarding("MEMBER", "demo-seed");
    const second = createSyntheticSignupOnboarding("MEMBER", "demo-seed");

    expect(first).toEqual(second);
    expect(first).toEqual({
      primaryGoal: expect.any(String),
      rhythm: expect.any(String),
      supportStyle: expect.any(String),
    });
  });

  it("builds role-specific summaries with fallback options", () => {
    expect(
      summarizeSignupOnboarding("ADMIN", {
        primaryGoal: "operations",
        rhythm: "critical",
        supportStyle: "action",
      })
    ).toEqual({
      title: "Klinik sahibi özeti",
      subtitle: "Klinik kurulumu, plan kararı ve operasyon başlangıcı bu profile göre kurgulandı.",
      pillars: [
        expect.objectContaining({ label: "Ana odak", value: "Günlük operasyon" }),
        expect.objectContaining({ label: "Ritim", value: "Anlık karar yoğun" }),
        expect.objectContaining({ label: "Destek tarzı", value: "Hızlı müdahale" }),
      ],
      recommendation: expect.stringContaining("Günlük operasyon"),
    });
  });

  it("returns stable defaults for each role", () => {
    expect(getDefaultSignupProfile("MEMBER")).toEqual(createSyntheticSignupOnboarding("MEMBER", "MEMBER"));
    expect(getDefaultSignupProfile("TRAINER")).toEqual(createSyntheticSignupOnboarding("TRAINER", "TRAINER"));
    expect(getDefaultSignupProfile("ADMIN")).toEqual(createSyntheticSignupOnboarding("ADMIN", "ADMIN"));
  });

  it("maps member signup answers into intake defaults", () => {
    expect(
      mapSignupProfileToMemberIntentDefaults({
        primaryGoal: "body",
        rhythm: "intense",
        supportStyle: "guided",
      })
    ).toEqual({
      goal: "Kilo / yağ / kas takibi istiyorum",
      issue: "Kilo kontrolü",
      expectation: "Birebir ilgi",
      weeklyDays: "4+ gün",
    });
  });
});
