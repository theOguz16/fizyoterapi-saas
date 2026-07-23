import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getSalonDayOptionsApi } from "@/lib/mobile-api";
import { findCurrentPackage, updateSelectedPackage } from "@/lib/member-package-queue";
import {
  buildMemberBookingTimeSelectionResult,
  canAddWeeklyPreference,
  countWeeklyPreferenceDays,
} from "@/lib/member-package-time-selection";
import {
  filterGroupClassSlotsForSelection,
  formatGroupClassPrice,
  getGroupClassAudienceLabel,
  getGroupClassCapacityLabel,
  getGroupClassDisplayName,
  getGroupClassScheduleLabel,
  isGroupClassBookingFlow,
} from "@/lib/group-classes";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SelectionChip } from "@/theme/components/selection-chip";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { EmptyState } from "@/theme/components/empty-state";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { tokens } from "@/theme/tokens";

type DraftPackageSelection = NonNullable<ReturnType<typeof useAppFlow>["memberBookingDraft"]["selectedPackages"]>[number];

function buildInitialSlotMap(selectedPackages: DraftPackageSelection[], fallbackSlots: ReturnType<typeof useAppFlow>["memberBookingDraft"]["preferredSlots"]) {
  const map: Record<string, string[]> = {};
  for (const pkg of selectedPackages) {
    map[pkg.package_id] = (pkg.preferred_slots || [])
      .map((slot) => slot.starts_at)
      .filter(Boolean);
  }
  for (const slot of fallbackSlots) {
    if (!slot.package_id) continue;
    map[slot.package_id] = [...(map[slot.package_id] || []), slot.starts_at];
  }
  return map;
}

function resolveRequiredPreferenceSlots(pkg?: DraftPackageSelection) {
  const explicitRequirement = Number(pkg?.required_preference_slots || 0);
  if (Number.isFinite(explicitRequirement) && explicitRequirement > 0) {
    return explicitRequirement;
  }
  return 1;
}

function resolveRequiredTrainerSlots(pkg?: DraftPackageSelection) {
  return pkg?.required_trainer_free_slots || 1;
}

function resolveWeeklyLessonCount(pkg?: DraftPackageSelection) {
  const raw = Number(pkg?.weekly_class_hours || pkg?.weekly_frequency || 1);
  return Math.min(7, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1));
}

function buildSlotLabel(slot: any, packageTitle?: string, includePackageTitle?: boolean) {
  const baseLabel = String(slot.label || "").trim();
  if (!includePackageTitle || !packageTitle) return baseLabel;
  return `${packageTitle} • ${baseLabel}`;
}

export default function TimeSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string; day?: string }>();
  const { memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const [dayFilter, setDayFilter] = useState(String(params.day || "ALL"));
  const isGroupFlow = isGroupClassBookingFlow(memberBookingDraft);

  const currentPackage = useMemo(() => findCurrentPackage(memberBookingDraft), [memberBookingDraft]);
  const selectedPackages = useMemo<DraftPackageSelection[]>(() => (currentPackage ? [currentPackage] : []), [currentPackage]);
  const [activePackageId, setActivePackageId] = useState<string>(currentPackage?.package_id || "");
  const [selectedSlotIdsByPackage, setSelectedSlotIdsByPackage] = useState<Record<string, string[]>>(() =>
    buildInitialSlotMap(selectedPackages, memberBookingDraft.preferredSlots)
  );

  useEffect(() => {
    if (!currentPackage || currentPackage.package_id !== activePackageId) {
      setActivePackageId(currentPackage?.package_id || "");
    }
  }, [activePackageId, currentPackage]);

  const activePackage = currentPackage || selectedPackages[0];

  const dayQuery = useQuery({
    queryKey: ["day-options", params.slug, activePackage?.package_id],
    queryFn: () => getSalonDayOptionsApi(String(params.slug), activePackage?.package_id ? [activePackage.package_id] : undefined),
  });

  const slots = useMemo(() => {
    const source = dayQuery.data;
    if (Array.isArray(source)) return source;
    return Array.isArray((source as any)?.data) ? (source as any).data : [];
  }, [dayQuery.data]);

  const scopedSlots = useMemo(
    () => filterGroupClassSlotsForSelection(slots, memberBookingDraft),
    [memberBookingDraft, slots]
  );

  const dayOptions = useMemo(
    () => Array.from(new Set(scopedSlots.map((slot: any) => String(slot.weekday_label || "").trim()).filter(Boolean))) as string[],
    [scopedSlots]
  );

  const filteredSlots = useMemo(
    () =>
      scopedSlots.filter((slot: any) => {
        return dayFilter === "ALL" || String(slot.weekday_label || "") === dayFilter;
      }),
    [dayFilter, scopedSlots]
  );

  const packageStatus = useMemo(
    () =>
      selectedPackages.map((pkg) => {
        const requiredPreferenceSlots = resolveRequiredPreferenceSlots(pkg);
        const requiredTrainerFreeSlots = resolveRequiredTrainerSlots(pkg);
        const selectedSlots = selectedSlotIdsByPackage[pkg.package_id] || [];
        const selectedCount = selectedSlots.length;
        const requiredDistinctDays = isGroupFlow ? 1 : resolveWeeklyLessonCount(pkg);
        const selectedDistinctDays = countWeeklyPreferenceDays(selectedSlots);
        return {
          package_id: pkg.package_id,
          package_title: pkg.package_title || pkg.package_id,
          selectedCount,
          requiredPreferenceSlots,
          requiredTrainerFreeSlots,
          remaining: Math.max(0, requiredPreferenceSlots - selectedCount),
          requiredDistinctDays,
          selectedDistinctDays,
          remainingDistinctDays: Math.max(0, requiredDistinctDays - selectedDistinctDays),
        };
      }),
    [isGroupFlow, selectedPackages, selectedSlotIdsByPackage]
  );

  const activeStatus = packageStatus.find((item) => item.package_id === activePackage?.package_id);
  const totalRemaining = packageStatus.reduce((sum, item) => sum + item.remaining, 0);
  const totalRemainingDistinctDays = packageStatus.reduce((sum, item) => sum + item.remainingDistinctDays, 0);
  const totalRequiredSlots = packageStatus.reduce((sum, item) => sum + item.requiredPreferenceSlots, 0);
  const totalSelectedSlots = packageStatus.reduce((sum, item) => sum + item.selectedCount, 0);
  const currentSlotIds = activePackage ? selectedSlotIdsByPackage[activePackage.package_id] || [] : [];
  const hasSelectableSlots = scopedSlots.length > 0;

  const continueLabel = !hasSelectableSlots
    ? "Uygun saat bekleniyor"
    : totalRemaining > 0
      ? `${totalRemaining} saat daha seç`
      : totalRemainingDistinctDays > 0
        ? `${totalRemainingDistinctDays} farklı gün daha seç`
        : "Özete geç";

  const handleContinue = () => {
    const { nextSelectedPackages, flattenedSlots } = buildMemberBookingTimeSelectionResult({
      selectedPackages,
      selectedSlotIdsByPackage,
      slots: slots.map((slot: any) => ({
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        label: buildSlotLabel(slot, undefined, false),
      })),
      includePackageTitle: false,
    });
    const nextPackage = nextSelectedPackages[0];

    setMemberBookingDraft({
      ...memberBookingDraft,
      selectedPackages:
        activePackage?.package_id && nextPackage
          ? updateSelectedPackage(memberBookingDraft, activePackage.package_id, () => nextPackage)
          : memberBookingDraft.selectedPackages,
      weeklyFrequency: Number(nextPackage?.weekly_frequency || nextPackage?.weekly_class_hours || 0),
      preferredSlots: flattenedSlots,
      requiredPreferenceSlots: activeStatus?.requiredPreferenceSlots || 0,
      requiredTrainerFreeSlots: activeStatus?.requiredTrainerFreeSlots || 0,
      groupClassFlow: isGroupFlow
        ? {
            selectedLessonName: memberBookingDraft.selectedSubLesson || activePackage?.package_title || "",
            selectedGroupClassId: String(scopedSlots[0]?.group_class_id || ""),
            notificationScope: scopedSlots[0]?.notification_scope || "SALON_MEMBERS",
            requiresAdminApproval: scopedSlots.some((slot: any) => Boolean(slot.requires_admin_approval)),
          }
        : undefined,
    });
    router.push({ pathname: "/(intake-member)/booking-summary", params: { slug: String(params.slug) } } as never);
  };

  return (
    <AppShell
      testID="intake-time-selection-screen"
      title="Uygun saatlerini seç"
      subtitle={
        isGroupFlow
          ? "Seçtiğin grup dersine uygun gün ve seanslar gösterilir. Talebin salon tarafından değerlendirilir."
          : "Her paket için salonun çalışma saatleri ve day options verisine göre açılan günlerden uygun slotlarını seç."
      }
      icon="clock"
      footer={
        <ActionButton
          testID="time-selection-continue"
          label={continueLabel}
          icon="calendar"
          onPress={handleContinue}
          disabled={
            selectedPackages.length === 0 ||
            !hasSelectableSlots ||
            totalRemaining > 0 ||
            totalRemainingDistinctDays > 0
          }
        />
      }
    >
      <AnimatedEntrance>
        <IntakeProgressCard
          step={5}
          total={6}
          icon="clock"
          eyebrow="Saat seçimi"
          title="Uygun seanslarını netleştiriyorsun"
          description="Seçtiğin paketin haftalık ritmine göre gereken slot sayısını tamamlayarak başvurunu netleştireceksin."
          badgeLabel={memberBookingDraft.trainerName || "Eğitmen seçildi"}
          badgeTone="success"
          summaryItems={[
            { label: "Paket", value: activePackage?.package_title || "Henüz seçilmedi" },
            { label: "Akış", value: isGroupFlow ? "Grup dersi" : memberBookingDraft.trainerName || "Henüz seçilmedi" },
            { label: "Toplam seçim", value: `${totalSelectedSlots} / ${totalRequiredSlots}` },
          ]}
          footnote={
            isGroupFlow
              ? "Sadece seçtiğin grup dersinin aktif günleri gösterilir. Özel tarihli ve tekrar eden seanslar birlikte listelenir."
              : "Özete geçmeden önce her paket için gereken slot sayısını tamamlamalısın; eğitmen uygunluğu bir sonraki kontrolde bu slotlar üstünden hesaplanır."
          }
        />
      </AnimatedEntrance>

      <AnimatedEntrance delay={60}>
        <SurfaceCard tone="primary">
          <Text style={styles.rule}>
            {isGroupFlow
              ? `${memberBookingDraft.selectedSubLesson || activePackage?.package_title || "Seçili grup dersi"} için en az ${activeStatus?.requiredPreferenceSlots || 0} seans seç.`
              : memberBookingDraft.trainerName
                ? `${memberBookingDraft.trainerName} için ${activePackage?.package_title || "seçili paket"} kuralına uygun en az ${activeStatus?.requiredPreferenceSlots || 0} slot seç.`
                : `${activePackage?.package_title || "Seçili paket"} için en az ${activeStatus?.requiredPreferenceSlots || 0} slot seç.`}
          </Text>
          <Text style={styles.progressText}>
            {activePackage?.package_title || "Paket"}: {activeStatus?.selectedCount || 0} / {activeStatus?.requiredPreferenceSlots || 0}
          </Text>
          <Text style={styles.progressSubtle}>
            Paket kuralı: haftada {activePackage?.weekly_class_hours || 0} ders • en az {activeStatus?.requiredTrainerFreeSlots || 0} eğitmen boşluğu
          </Text>
          {!isGroupFlow ? (
            <Text style={styles.progressSubtle}>
              Gün dağılımı: {activeStatus?.selectedDistinctDays || 0} / {activeStatus?.requiredDistinctDays || 1} farklı gün • bir günde en fazla 3 tercih
            </Text>
          ) : null}
          {isGroupFlow ? (
            <Text style={styles.groupHint}>
              Eğitmen tek tarihli veya haftalık tekrar eden grup seansları açabilir. Talebin sonrası uygun üyeler bilgilendirilir ve ücret onayı salon tarafından değerlendirilir.
            </Text>
          ) : null}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={120}>
        <SurfaceCard>
          <Text style={styles.section}>{isGroupFlow ? "Grup dersi günleri" : "Gün filtresi"}</Text>
          {isGroupFlow ? <Text style={styles.groupHint}>Burada yalnızca seçtiğin grup dersine uygun günler gösterilir.</Text> : null}
          <View style={styles.chips}>
            <SelectionChip
              testID="time-day-filter-all"
              label={isGroupFlow ? "Tüm aktif günler" : "Tüm günler"}
              active={dayFilter === "ALL"}
              onPress={() => setDayFilter("ALL")}
            />
            {dayOptions.map((option) => (
              <SelectionChip
                key={option}
                testID={`time-day-filter-${option.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-")}`}
                label={option}
                active={dayFilter === option}
                onPress={() => setDayFilter(option)}
              />
            ))}
          </View>
        </SurfaceCard>
      </AnimatedEntrance>

      {filteredSlots.length === 0 ? (
        <EmptyState
          title="Uygun saat bulunamadı"
          description={
            isGroupFlow
              ? "Bu grup dersi için aktif gün görünmüyor. Farklı bir alt ders seçebilir veya salonun yeni duyurusunu bekleyebilirsin."
              : "Bu gün filtresine uygun bir slot görünmüyor. Farklı bir gün seçebilirsin."
          }
          icon="calendar"
        />
      ) : (
        filteredSlots.map((slot: any, index: number) => {
          const active = currentSlotIds.includes(slot.starts_at);
          const activePackageIndex = selectedPackages.findIndex((pkg) => pkg.package_id === activePackage?.package_id);
          return (
            <AnimatedEntrance key={`${activePackage?.package_id || "package"}-${slot.starts_at}`} delay={160 + index * 45} distance={10}>
              <SurfaceCard tone={active ? "primary" : "default"}>
                <View style={styles.slotHeader}>
                  <Text style={styles.slotTitle}>{isGroupFlow ? getGroupClassDisplayName(slot) || slot.label : slot.label}</Text>
                  {active ? <Text style={styles.slotBadge}>Seçildi</Text> : null}
                </View>
                <View style={styles.slotInfoRow}>
                  <AppIcon name="calendar" size="sm" tone="primary" />
                  <Text style={styles.slotCopy}>{slot.weekday_label || ""} • {slot.time_range_label || ""}</Text>
                </View>
                {isGroupFlow ? (
                  <>
                    <Text style={styles.slotCopy}>Plan: {getGroupClassScheduleLabel(slot)}</Text>
                    <Text style={styles.slotCopy}>Ücret: {formatGroupClassPrice(slot.price)}</Text>
                    <Text style={styles.slotCopy}>Bildirim: {getGroupClassAudienceLabel(slot.notification_scope)}</Text>
                    <Text style={styles.slotCopy}>Katılım: {getGroupClassCapacityLabel(slot)}</Text>
                    <Text style={styles.slotCopy}>
                      Onay: {slot.requires_admin_approval ? "Katılım sonrası admin ücreti onaylar" : "Doğrudan salon akışına düşer"}
                    </Text>
                  </>
                ) : null}
                <ActionButton
                  testID={`time-slot-toggle-${Math.max(activePackageIndex, 0)}-${index}`}
                  label={active ? "Seçimi kaldır" : isGroupFlow ? "Bu gruba katıl" : "Bu saati seç"}
                  icon={active ? "calendar" : "clock"}
                  variant={active ? "primary" : "ghost"}
                  onPress={() => {
                    if (!activePackage) return;
                    setSelectedSlotIdsByPackage((current) => {
                      const currentIds = current[activePackage.package_id] || [];
                      const currentPackageRequirement = resolveRequiredPreferenceSlots(activePackage);
                      if (!currentIds.includes(slot.starts_at) && currentIds.length >= currentPackageRequirement) {
                        Alert.alert(
                          "Seçim tamamlandı",
                          `${activePackage.package_title || "Bu paket"} için en fazla ${currentPackageRequirement} saat seçebilirsin.`
                        );
                        return current;
                      }
                      if (
                        !isGroupFlow &&
                        !currentIds.includes(slot.starts_at) &&
                        !canAddWeeklyPreference(currentIds, slot.starts_at)
                      ) {
                        Alert.alert(
                          "Farklı bir gün seç",
                          "Aynı gün için en fazla 3 saat tercihi seçebilirsin. Haftalık derslerin farklı günlere dağıtılmalıdır."
                        );
                        return current;
                      }
                      const nextSelection = {
                        ...current,
                        [activePackage.package_id]: currentIds.includes(slot.starts_at)
                          ? currentIds.filter((item) => item !== slot.starts_at)
                          : [...currentIds, slot.starts_at],
                      };

                      if (!currentIds.includes(slot.starts_at)) {
                        const selectedCount = nextSelection[activePackage.package_id]?.length || 0;
                        if (selectedCount >= currentPackageRequirement) {
                          const nextPackage = selectedPackages.find((pkg) => {
                            const requiredCount = resolveRequiredPreferenceSlots(pkg);
                            const chosenCount = nextSelection[pkg.package_id]?.length || 0;
                            return pkg.package_id !== activePackage.package_id && chosenCount < requiredCount;
                          });
                          if (nextPackage) {
                            setActivePackageId(nextPackage.package_id);
                          }
                        }
                      }

                      return nextSelection;
                    });
                  }}
                />
              </SurfaceCard>
            </AnimatedEntrance>
          );
        })
      )}

    </AppShell>
  );
}

const styles = StyleSheet.create({
  rule: {
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
  filterBlock: {
    gap: tokens.spacing.sm,
  },
  progressText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  progressSubtle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  groupHint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  slotTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  slotBadge: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    backgroundColor: "rgba(151,187,156,0.16)",
    borderWidth: 1,
    borderColor: "rgba(111,146,116,0.2)",
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slotCopy: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  slotInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
});
