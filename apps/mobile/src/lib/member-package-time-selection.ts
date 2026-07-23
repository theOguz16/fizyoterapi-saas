import type { MemberBookingDraft } from "@/providers/app-flow";

type DraftPackageSelection = NonNullable<MemberBookingDraft["selectedPackages"]>[number];
type PreferredSlot = MemberBookingDraft["preferredSlots"][number];

export function weeklyPreferenceDayKey(value: string, timezone = "Europe/Istanbul") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function countWeeklyPreferenceDays(values: string[], timezone = "Europe/Istanbul") {
  return new Set(values.map((value) => weeklyPreferenceDayKey(value, timezone))).size;
}

export function canAddWeeklyPreference(
  selectedValues: string[],
  candidate: string,
  timezone = "Europe/Istanbul",
  maximumPerDay = 3
) {
  const candidateDay = weeklyPreferenceDayKey(candidate, timezone);
  return selectedValues.filter((value) => weeklyPreferenceDayKey(value, timezone) === candidateDay).length < maximumPerDay;
}

export function buildMemberBookingTimeSelectionResult(input: {
  selectedPackages: DraftPackageSelection[];
  selectedSlotIdsByPackage: Record<string, string[]>;
  slots: Array<{
    starts_at: string;
    ends_at: string;
    label: string;
  }>;
  includePackageTitle: boolean;
}) {
  const nextSelectedPackages = input.selectedPackages.map((pkg) => {
    const selectedSlotIds = input.selectedSlotIdsByPackage[pkg.package_id] || [];
    const preferredSlots = input.slots
      .filter((slot) => selectedSlotIds.includes(slot.starts_at))
      .map((slot) => ({
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        label: slot.label,
        package_id: pkg.package_id,
        package_title: pkg.package_title,
      }));

    return {
      ...pkg,
      weekly_frequency: pkg.weekly_frequency || pkg.weekly_class_hours || 0,
      preferred_slots: preferredSlots,
    };
  });

  const flattenedSlots: PreferredSlot[] = nextSelectedPackages.flatMap((pkg) =>
    (pkg.preferred_slots || []).map((slot) => ({
      ...slot,
      label: input.includePackageTitle && pkg.package_title ? `${pkg.package_title} • ${slot.label}` : slot.label,
    }))
  );

  return {
    nextSelectedPackages,
    flattenedSlots,
  };
}
