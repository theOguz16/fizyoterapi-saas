import type { MemberBookingDraft } from "@/providers/app-flow";

type DraftPackageSelection = NonNullable<MemberBookingDraft["selectedPackages"]>[number];

function buildFallbackPackage(draft: MemberBookingDraft): DraftPackageSelection | null {
  if (!draft.packageId) return null;
  return {
    package_id: draft.packageId,
    package_title: draft.packageTitle,
    package_price: draft.packagePrice,
    lesson_mode: draft.lessonMode,
    total_credits: draft.requiredPreferenceSlots,
    weekly_class_hours: draft.weeklyClassHours,
    required_preference_slots: draft.requiredPreferenceSlots,
    required_trainer_free_slots: draft.requiredTrainerFreeSlots,
    preferred_slots: draft.preferredSlots,
    weekly_frequency: draft.weeklyFrequency,
    trainer_id: draft.trainerId,
    trainer_name: draft.trainerName,
    selected_sub_lesson: draft.selectedSubLesson,
    duo_partner_name: draft.duoPartnerName,
    duo_partner_contact: draft.duoPartnerContact,
  };
}

export function resolveSelectedPackages(draft: MemberBookingDraft) {
  if (draft.selectedPackages && draft.selectedPackages.length > 0) {
    return draft.selectedPackages;
  }
  const fallback = buildFallbackPackage(draft);
  return fallback ? [fallback] : [];
}

export function findCurrentPackage(draft: MemberBookingDraft) {
  const selectedPackages = resolveSelectedPackages(draft);
  if (selectedPackages.length === 0) return null;
  if (draft.currentPackageId) {
    const match = selectedPackages.find((pkg) => pkg.package_id === draft.currentPackageId);
    if (match) return match;
  }
  const submittedIds = new Set(draft.submittedPackageIds || []);
  return selectedPackages.find((pkg) => !submittedIds.has(pkg.package_id)) || selectedPackages[0];
}

export function updateSelectedPackage(
  draft: MemberBookingDraft,
  packageId: string,
  updater: (pkg: DraftPackageSelection) => DraftPackageSelection
) {
  return resolveSelectedPackages(draft).map((pkg) => (pkg.package_id === packageId ? updater(pkg) : pkg));
}

export function applyCurrentPackageToDraft(draft: MemberBookingDraft, packageId: string): MemberBookingDraft {
  const currentPackage = resolveSelectedPackages(draft).find((pkg) => pkg.package_id === packageId);
  if (!currentPackage) return draft;

  return {
    ...draft,
    currentPackageId: packageId,
    packageId: currentPackage.package_id,
    packageTitle: currentPackage.package_title || "",
    packagePrice: currentPackage.package_price || "",
    lessonMode: currentPackage.lesson_mode || "",
    weeklyClassHours: Number(currentPackage.weekly_class_hours || 0),
    requiredPreferenceSlots: Number(currentPackage.required_preference_slots || 0),
    requiredTrainerFreeSlots: Number(currentPackage.required_trainer_free_slots || 0),
    preferredSlots: currentPackage.preferred_slots || [],
    weeklyFrequency: Number(currentPackage.weekly_frequency || currentPackage.weekly_class_hours || 0),
    trainerId: currentPackage.trainer_id || "",
    trainerName: currentPackage.trainer_name || "",
    selectedSubLesson: currentPackage.selected_sub_lesson || "",
    duoPartnerName: currentPackage.duo_partner_name || "",
    duoPartnerContact: currentPackage.duo_partner_contact || "",
  };
}

export function findNextUnsubmittedPackage(draft: MemberBookingDraft, excludePackageId?: string) {
  const submittedIds = new Set(draft.submittedPackageIds || []);
  if (excludePackageId) {
    submittedIds.add(excludePackageId);
  }
  return resolveSelectedPackages(draft).find((pkg) => !submittedIds.has(pkg.package_id)) || null;
}
