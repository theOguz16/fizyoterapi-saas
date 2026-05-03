import { useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { tokens } from "@/theme/tokens";

export default function E2EMultiPackageBootstrapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const { setMemberBookingDraft } = useAppFlow();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const slug = String(params.slug || "demo-salon");
      const selectedRows = [
        {
          id: "e2e-group-8",
          title: "Grup Dersi (8 Kişi)",
          display_price: "200",
          summary: "Haftalik grup dersi paketi",
          lesson_mode: "GROUP",
          weekly_class_hours: 1,
          required_preference_slots: 1,
          required_trainer_free_slots: 0,
          allow_drop_in_booking: true,
        },
        {
          id: "e2e-group-4",
          title: "Grup Dersi (4 Kişi)",
          display_price: "250",
          summary: "Kucuk grup dersi paketi",
          lesson_mode: "GROUP",
          weekly_class_hours: 1,
          required_preference_slots: 1,
          required_trainer_free_slots: 0,
          allow_drop_in_booking: true,
        },
      ];

      if (cancelled || selectedRows.length < 2) {
        return;
      }

      const validPackageSlots = [
        {
          package_id: "e2e-group-8",
          starts_at: "2026-05-04T15:00:00.000Z",
          ends_at: "2026-05-04T16:00:00.000Z",
          label: "Pazartesi • 15:00",
        },
        {
          package_id: "e2e-group-4",
          starts_at: "2026-05-05T18:00:00.000Z",
          ends_at: "2026-05-05T19:00:00.000Z",
          label: "Salı • 18:00",
        },
      ];
      if (cancelled || validPackageSlots.length < 2) {
        return;
      }

      setMemberBookingDraft({
        e2eBypassSubmit: true,
        salonSlug: slug,
        salonName: "Demo Salon",
        packageId: String(selectedRows[0]?.id || ""),
        packageIds: selectedRows.map((row: any) => String(row.id)),
        currentPackageId: String(selectedRows[0]?.id || ""),
        submittedPackageIds: [],
        lessonMode: String(selectedRows[0]?.lesson_mode || "GROUP"),
        allowDropInBooking: selectedRows.every((row: any) => Boolean(row.allow_drop_in_booking)),
        selectedSubLesson: String(selectedRows[0]?.title || ""),
        selectedPackages: selectedRows.map((row: any) => ({
          package_id: String(row.id),
          package_title: String(row.title || ""),
          package_price: String(row.display_price || ""),
          lesson_mode: String(row.lesson_mode || ""),
          weekly_class_hours: Number(row.weekly_class_hours || 0),
          required_preference_slots: Number(row.required_preference_slots || 1),
          required_trainer_free_slots: Number(row.required_trainer_free_slots || 1),
          preferred_slots: validPackageSlots
            .filter((slot) => slot.package_id === String(row.id))
            .map((slot) => ({
              starts_at: slot.starts_at,
              ends_at: slot.ends_at,
              label: slot.label,
              package_id: slot.package_id,
              package_title: String(row.title || ""),
            })),
          weekly_frequency: Number(row.weekly_class_hours || 1),
        })),
        packageTitle: selectedRows.map((row: any) => String(row.title || "")).join(", "),
        packagePrice: String(selectedRows.reduce((sum: number, row: any) => sum + Number(row.display_price || 0), 0)),
        packageSummary: selectedRows.map((row: any) => String(row.summary || row.title || "")).join(" • "),
        weeklyClassHours: selectedRows.reduce((sum: number, row: any) => sum + Number(row.weekly_class_hours || 0), 0),
        requiredPreferenceSlots: selectedRows.reduce((sum: number, row: any) => sum + Number(row.required_preference_slots || 1), 0),
        requiredTrainerFreeSlots: selectedRows.reduce((sum: number, row: any) => sum + Number(row.required_trainer_free_slots || 1), 0),
        preferredSlots: validPackageSlots
          .filter((slot) => slot.package_id === String(selectedRows[0]?.id || ""))
          .map((slot) => ({
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            label: slot.label,
            package_id: slot.package_id,
            package_title: String(selectedRows[0]?.title || ""),
          })),
        weeklyFrequency: selectedRows.reduce((sum: number, row: any) => sum + Number(row.weekly_class_hours || 1), 0),
        groupClassFlow: {
          selectedLessonName: String(selectedRows[0]?.title || ""),
          selectedGroupClassId: "",
          notificationScope: "SALON_MEMBERS",
          requiresAdminApproval: true,
        },
      });

      router.replace({
        pathname: "/(intake-member)/booking-summary",
        params: {
          slug,
          packageId: String(selectedRows[0]?.id || ""),
        },
      } as never);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [params.slug, router, setMemberBookingDraft]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={tokens.colors.primaryStrong} />
      <Text style={styles.copy}>Coklu paket testi hazirlaniyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
});
