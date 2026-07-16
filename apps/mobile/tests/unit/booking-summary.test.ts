import { describe, expect, it } from "vitest";
import { buildBookingSummaryModel, buildMemberPurchaseDraft } from "@/lib/booking-summary";
import type { MemberBookingDraft } from "@/providers/app-flow";

const slot = {
  starts_at: "2026-07-20T09:00:00.000Z",
  ends_at: "2026-07-20T10:00:00.000Z",
  label: "Pazartesi 12:00",
};

const draft: MemberBookingDraft = {
  packageId: "package-1",
  packageTitle: "Başlangıç",
  requiredPreferenceSlots: 1,
  requiredTrainerFreeSlots: 1,
  preferredSlots: [slot],
};

describe("booking summary", () => {
  it("selects an available trainer and validates required slots", () => {
    const summary = buildBookingSummaryModel(draft, [{ id: "trainer-1", full_name: "Uzman", matching_slots: 1, is_available: true }], true);
    expect(summary.canSubmit).toBe(true);
    expect(summary.selectedTrainer?.id).toBe("trainer-1");
    expect(summary.trainerWasAutoSelected).toBe(true);
  });

  it("keeps trainer hidden for packages that do not require one", () => {
    const payload = buildMemberPurchaseDraft({ slug: "klinik", draft, trainers: [], requiresTrainer: false, note: "İlk görüşme" });
    expect(payload).toMatchObject({ tenant_slug: "klinik", package_id: "package-1", selected_days: [slot], note: "İlk görüşme" });
    expect(payload.trainer_id).toBeUndefined();
  });

  it("blocks submission when required preference slots are missing", () => {
    const summary = buildBookingSummaryModel({ ...draft, requiredPreferenceSlots: 2 }, [], false);
    expect(summary.missingPreferenceSlots).toBe(1);
    expect(summary.canSubmit).toBe(false);
  });
});
