import { useLocalSearchParams, useRouter } from "expo-router";
import { SelectionChip } from "@/theme/components/selection-chip";
import { StyleSheet, Text, View } from "react-native";
import { updateSelectedPackage } from "@/lib/member-package-queue";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { tokens } from "@/theme/tokens";

export default function PackageDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string; id: string; title: string; price: string; summary: string; credits: string; weeklyClassHours: string; requiredPreferenceSlots: string; requiredTrainerFreeSlots: string; subLessons?: string }>();
  const { memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const directToTimeSelection = memberBookingDraft.allowDropInBooking || memberBookingDraft.lessonMode === "GROUP";
  const subLessons = String(params.subLessons || "").split("||").map((item) => item.trim()).filter(Boolean);
  const selectedGroupLesson = memberBookingDraft.selectedSubLesson || (subLessons.length === 1 ? subLessons[0] : "");

  return (
    <AppShell title={String(params.title || "Paket detayı")} subtitle="Paket kapsamını inceleyip senin için uygun akışla devam et." icon="package">
      <IntakeProgressCard
        step={3}
        total={6}
        icon="package"
        eyebrow="Paket detayı"
        title="Paket detayını inceliyorsun"
        description="Bir sonraki adımlarda saat seçimi, uygunluk ve yerleşim bu paket kurallarına göre şekillenecek."
        badgeLabel={memberBookingDraft.salonName || "Salon seçildi"}
        badgeTone="success"
        summaryItems={[
          { label: "Paket", value: String(params.title || "-") },
          { label: "Toplam ders", value: `${String(params.credits || "0")} ders` },
          { label: "Haftalık ritim", value: `${String(params.weeklyClassHours || "0")} ders / hafta` },
        ]}
        footnote="Detayları gözden geçirdikten sonra uygun saat veya eğitmen seçimine geçeceksin."
      />

      <SurfaceCard tone="primary">
        <Text style={styles.price}>{String(params.price || "-")}</Text>
        <Text style={styles.copy}>{String(params.credits || "0")} ders • {String(params.summary || "Paket seçiminin ardından sana uygun seans akışını tamamlayacaksın.")}</Text>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard label="Toplam ders" value={String(params.credits || "0")} hint="Paket hakkı" icon="calendar" />
        <MetricCard label="Saat tercihi" value={String(params.requiredPreferenceSlots || "0")} hint="Seçilecek slot" icon="clock" />
      </View>

      <SurfaceCard>
        <Text style={styles.section}>Bilmen gerekenler</Text>
        <View style={styles.pointList}>
          <DecisionRow icon="spark" text="Bu paket düzenli katılım planı oluşturmak isteyen üyeler için uygundur." />
          <DecisionRow icon={directToTimeSelection ? "clock" : "trainer"} text={directToTimeSelection ? "Grup dersi seçtikten sonra doğrudan uygun seansları görürsün." : "Önce eğitmenini seçer, ardından uygun saatlerini belirlersin."} />
          <DecisionRow icon="calendar" text={`Paket kuralı: haftada ${String(params.weeklyClassHours || "0")} ders ritmi için en az ${String(params.requiredPreferenceSlots || "0")} slot seçmelisin.`} />
          <DecisionRow icon="trainer" text={`Onay için bu slotların en az ${String(params.requiredTrainerFreeSlots || "0")} tanesinde eğitmenin takvimi boş olmalı.`} />
          {directToTimeSelection ? <DecisionRow icon="calendar" text="Sadece seçtiğin grup dersine uygun gün ve seanslar gösterilir. Katılım talebin ücret onayıyla birlikte değerlendirilir." /> : null}
        </View>
        {directToTimeSelection && subLessons.length > 0 ? (
          <View style={styles.subLessonWrap}>
            <Text style={styles.section}>Katılmak istediğin grup dersini seç</Text>
            <View style={styles.chips}>
              {subLessons.map((lesson) => (
                <SelectionChip
                  key={lesson}
                  label={lesson}
                  active={memberBookingDraft.selectedSubLesson === lesson}
                  onPress={() =>
                    setMemberBookingDraft({
                      ...memberBookingDraft,
                      selectedSubLesson: memberBookingDraft.selectedSubLesson === lesson ? "" : lesson,
                      groupClassFlow: {
                        ...memberBookingDraft.groupClassFlow,
                        selectedLessonName: memberBookingDraft.selectedSubLesson === lesson ? "" : lesson,
                        requiresAdminApproval: true,
                        notificationScope: "SALON_MEMBERS",
                      },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </SurfaceCard>

      <ActionButton
        label={directToTimeSelection ? "Saat seçimine geç" : "Eğitmen seçimine geç"}
        icon="spark"
        onPress={() => {
          const selectedSubLesson = selectedGroupLesson;
          setMemberBookingDraft({
            ...memberBookingDraft,
            packageId: String(params.id),
            currentPackageId: String(params.id),
            packageTitle: String(params.title),
            packagePrice: String(params.price),
            packageSummary: String(params.summary),
            weeklyClassHours: Number(params.weeklyClassHours || 0),
            requiredPreferenceSlots: Number(params.requiredPreferenceSlots || 0),
            requiredTrainerFreeSlots: Number(params.requiredTrainerFreeSlots || 0),
            selectedSubLesson,
            selectedPackages: updateSelectedPackage(memberBookingDraft, String(params.id), (pkg) => ({
              ...pkg,
              selected_sub_lesson: selectedSubLesson,
            })),
            groupClassFlow: directToTimeSelection
              ? {
                  selectedLessonName: selectedSubLesson,
                  selectedGroupClassId: memberBookingDraft.groupClassFlow?.selectedGroupClassId || "",
                  notificationScope: memberBookingDraft.groupClassFlow?.notificationScope || "SALON_MEMBERS",
                  requiresAdminApproval: true,
                }
              : undefined,
          });
          router.push({ pathname: directToTimeSelection ? "/(intake-member)/time-selection" : "/(intake-member)/trainer-selection", params: { slug: String(params.slug) } } as never);
        }}
      />
    </AppShell>
  );
}

function DecisionRow({ icon, text }: { icon: "spark" | "clock" | "trainer" | "calendar"; text: string }) {
  return (
    <View style={styles.pointRow}>
      <View style={styles.pointIcon}>
        <AppIcon name={icon} size="sm" tone="primary" variant="plain" />
      </View>
      <Text style={styles.point}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  price: {
    color: tokens.colors.text,
    fontSize: tokens.font.display,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  subLessonWrap: {
    gap: tokens.spacing.sm,
  },
  pointList: {
    gap: tokens.spacing.sm,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(111,146,116,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  point: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
