import type { MemberPurchaseDraft, PurchaseDaySelection, TrainerOption } from "@/lib/mobile-api";
import { findCurrentPackage } from "@/lib/member-package-queue";
import type { MemberBookingDraft } from "@/providers/app-flow";

export function buildBookingSummaryModel(
  draft: MemberBookingDraft,
  trainers: TrainerOption[],
  requiresTrainer: boolean,
) {
  const currentPackage = findCurrentPackage(draft);
  const selectedDays: PurchaseDaySelection[] = currentPackage?.preferred_slots || draft.preferredSlots;
  const selectedTrainer = requiresTrainer
    ? trainers.find((item) => String(item.id) === String(draft.trainerId)) ||
      trainers.find((item) => item.is_available !== false) ||
      trainers[0] ||
      null
    : null;
  const requiredPreferenceSlots = Number(draft.requiredPreferenceSlots || 0);
  const requiredTrainerFreeSlots = Number(draft.requiredTrainerFreeSlots || 0);
  const matchingSlotCount = Number(selectedTrainer?.matching_slots || 0);
  const missingPreferenceSlots = Math.max(0, requiredPreferenceSlots - selectedDays.length);
  const missingTrainerSlots = requiresTrainer ? Math.max(0, requiredTrainerFreeSlots - matchingSlotCount) : 0;
  const hasTrainerSelection = !requiresTrainer || Boolean(selectedTrainer?.id || currentPackage?.trainer_id || draft.trainerId);

  return {
    currentPackage,
    selectedDays,
    selectedTrainer,
    trainerWasAutoSelected: requiresTrainer && Boolean(selectedTrainer?.id) && !draft.trainerId && !currentPackage?.trainer_id,
    requiredPreferenceSlots,
    requiredTrainerFreeSlots,
    missingPreferenceSlots,
    missingTrainerSlots,
    hasTrainerSelection,
    canSubmit: Boolean(currentPackage?.package_id || draft.packageId) && missingPreferenceSlots === 0 && hasTrainerSelection,
  };
}

export function buildMemberPurchaseDraft(input: {
  slug: string;
  draft: MemberBookingDraft;
  trainers: TrainerOption[];
  requiresTrainer: boolean;
  note?: string;
}): MemberPurchaseDraft {
  const summary = buildBookingSummaryModel(input.draft, input.trainers, input.requiresTrainer);
  const currentPackage = summary.currentPackage;
  const isDuo = String(currentPackage?.lesson_mode || input.draft.lessonMode || "").toUpperCase() === "DUO";

  return {
    tenant_slug: input.slug,
    selected_days: summary.selectedDays,
    package_id: String(currentPackage?.package_id || input.draft.packageId || ""),
    package_ids: currentPackage?.package_id ? [String(currentPackage.package_id)] : undefined,
    selected_packages: currentPackage
      ? [{
          package_id: currentPackage.package_id,
          package_title: currentPackage.package_title,
          package_price: currentPackage.package_price,
          preferred_slots: currentPackage.preferred_slots,
          weekly_frequency: currentPackage.weekly_frequency,
          duo_partner_name: currentPackage.duo_partner_name,
          duo_partner_contact: currentPackage.duo_partner_contact,
        }]
      : undefined,
    trainer_id: input.requiresTrainer
      ? String(summary.selectedTrainer?.id || currentPackage?.trainer_id || input.draft.trainerId || "")
      : undefined,
    selected_sub_lesson: currentPackage?.selected_sub_lesson || input.draft.selectedSubLesson,
    duo_partner_name: isDuo ? currentPackage?.duo_partner_name || input.draft.duoPartnerName : undefined,
    duo_partner_contact: isDuo ? currentPackage?.duo_partner_contact || input.draft.duoPartnerContact : undefined,
    note: input.note,
    availability_context: {
      source: "MEMBER_AVAILABILITY",
      visibility: "TRAINER_HIDDEN",
      selected_by: "MEMBER",
    },
  };
}
