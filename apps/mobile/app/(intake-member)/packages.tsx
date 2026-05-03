import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getPublicSalonPackagesApi } from "@/lib/mobile-api";
import { applyCurrentPackageToDraft, findNextUnsubmittedPackage } from "@/lib/member-package-queue";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { EmptyState } from "@/theme/components/empty-state";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { SelectionChip } from "@/theme/components/selection-chip";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

type PackageFilterKey = "ALL" | "GROUP" | "PT" | "SCOLIOSIS" | "PILATES" | "REFORMER";
type PackageModeFilterKey = "ALL" | "SINGLE" | "DUO" | "GROUP";

const FILTER_LABELS: Record<PackageFilterKey, string> = {
  ALL: "Tümü",
  GROUP: "Grup dersi",
  PT: "PT",
  SCOLIOSIS: "Skolyoz",
  PILATES: "Pilates",
  REFORMER: "Reformer",
};

const MODE_FILTER_LABELS: Record<PackageModeFilterKey, string> = {
  ALL: "Tüm akışlar",
  SINGLE: "Single",
  DUO: "Duo",
  GROUP: "Group",
};

export default function PackageListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const { memberIntent, memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const [activeFilter, setActiveFilter] = useState<PackageFilterKey>("ALL");
  const [activeModeFilter, setActiveModeFilter] = useState<PackageModeFilterKey>("ALL");

  const packageQuery = useQuery({
    queryKey: ["public-packages", params.slug],
    queryFn: () => getPublicSalonPackagesApi(String(params.slug)),
  });

  const packages = Array.isArray(packageQuery.data)
    ? packageQuery.data
    : Array.isArray((packageQuery.data as any)?.data)
      ? (packageQuery.data as any).data
      : [];
  const suggestedFilter = useMemo(() => deriveSuggestedFilter(memberIntent), [memberIntent]);
  const rankedPackages = useMemo(
    () =>
      [...packages].sort(
        (a: any, b: any) => scorePackageForIntent(b, memberIntent, suggestedFilter) - scorePackageForIntent(a, memberIntent, suggestedFilter)
      ),
    [memberIntent, packages, suggestedFilter]
  );
  const availableFilters = useMemo(() => {
    const keys = new Set<PackageFilterKey>(["ALL"]);
    rankedPackages.forEach((pkg: any) => {
      resolvePackageFilters(pkg).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [rankedPackages]);
  const availableModeFilters = useMemo(() => {
    const keys = new Set<PackageModeFilterKey>(["ALL"]);
    rankedPackages.forEach((pkg: any) => {
      const mode = resolvePackageMode(pkg);
      if (mode) {
        keys.add(mode);
      }
    });
    return Array.from(keys);
  }, [rankedPackages]);
  const filteredPackages = useMemo(() => {
    return rankedPackages.filter((pkg: any) => {
      const matchesService = activeFilter === "ALL" || resolvePackageFilters(pkg).includes(activeFilter);
      const matchesMode = activeModeFilter === "ALL" || resolvePackageMode(pkg) === activeModeFilter;
      return matchesService && matchesMode;
    });
  }, [activeFilter, activeModeFilter, rankedPackages]);
  const selectedPackageIds = useMemo(() => {
    const ids = [
      ...(memberBookingDraft.packageIds || []),
      ...((memberBookingDraft.selectedPackages || []).map((item) => item.package_id)),
      ...(memberBookingDraft.packageId ? [memberBookingDraft.packageId] : []),
    ].filter(Boolean);
    return new Set(ids);
  }, [memberBookingDraft.packageId, memberBookingDraft.packageIds, memberBookingDraft.selectedPackages]);
  const submittedPackageIds = useMemo(() => new Set(memberBookingDraft.submittedPackageIds || []), [memberBookingDraft.submittedPackageIds]);
  const currentPackageId = memberBookingDraft.currentPackageId || "";

  function togglePackageSelection(pkg: any) {
    const current = new Set(selectedPackageIds);
    const packageId = String(pkg.id);
    if (current.has(packageId)) {
      current.delete(packageId);
    } else {
      current.add(packageId);
    }
    const nextIds = Array.from(current);
    const selectedRows = rankedPackages.filter((row: any) => nextIds.includes(String(row.id)));
    const aggregateTitle =
      selectedRows.length > 1 ? `${selectedRows.length} paket seçildi` : String(selectedRows[0]?.title || "");
    const aggregateSummary =
      selectedRows.map((row: any) => String(row.summary || row.title || "")).filter(Boolean).join(" • ");
    const existingSelections = new Map(
      (memberBookingDraft.selectedPackages || []).map((item) => [item.package_id, item])
    );
    setMemberBookingDraft({
      ...memberBookingDraft,
      packageId: String(selectedRows[0]?.id || ""),
      packageIds: nextIds,
      currentPackageId: current.has(memberBookingDraft.currentPackageId || "") ? memberBookingDraft.currentPackageId : "",
      submittedPackageIds: (memberBookingDraft.submittedPackageIds || []).filter((id) => nextIds.includes(id)),
      lessonMode: String(selectedRows[0]?.lesson_mode || ""),
      allowDropInBooking: selectedRows.length > 0 && selectedRows.every((row: any) => Boolean(row.allow_drop_in_booking)),
      selectedPackages: selectedRows.map((row: any) => ({
        package_id: String(row.id),
        package_title: String(row.title || ""),
        package_price: String(row.display_price || ""),
        total_credits: Number(row.total_credits || 0),
        lesson_mode: String(row.lesson_mode || ""),
        weekly_class_hours: Number(row.weekly_class_hours || 0),
        required_preference_slots: Number(row.required_preference_slots || 0),
        required_trainer_free_slots: Number(row.required_trainer_free_slots || 0),
        preferred_slots: existingSelections.get(String(row.id))?.preferred_slots || [],
        weekly_frequency: existingSelections.get(String(row.id))?.weekly_frequency,
        trainer_id: existingSelections.get(String(row.id))?.trainer_id || "",
        trainer_name: existingSelections.get(String(row.id))?.trainer_name || "",
        selected_sub_lesson: existingSelections.get(String(row.id))?.selected_sub_lesson || "",
      })),
      packageTitle: aggregateTitle,
      packagePrice: String(
        selectedRows.reduce((sum: number, row: any) => sum + Number(row.display_price || 0), 0)
      ),
      packageSummary: aggregateSummary,
      weeklyClassHours: selectedRows.reduce((sum: number, row: any) => sum + Number(row.weekly_class_hours || 0), 0),
      requiredPreferenceSlots: selectedRows.reduce(
        (sum: number, row: any) => sum + Math.max(1, Number(row.required_preference_slots || 0) || 1),
        0
      ),
      requiredTrainerFreeSlots: selectedRows.reduce(
        (sum: number, row: any) => sum + Math.max(1, Number(row.required_trainer_free_slots || 0) || 1),
        0
      ),
      preferredSlots: (memberBookingDraft.preferredSlots || []).filter((slot) => nextIds.includes(String(slot.package_id || ""))),
      groupClassFlow:
        selectedRows.length > 0 && selectedRows.every((row: any) => String(row.lesson_mode || "").toUpperCase() === "GROUP" || Boolean(row.allow_drop_in_booking))
          ? {
              selectedLessonName: memberBookingDraft.selectedSubLesson || "",
              selectedGroupClassId: memberBookingDraft.groupClassFlow?.selectedGroupClassId || "",
              notificationScope: memberBookingDraft.groupClassFlow?.notificationScope || "SALON_MEMBERS",
              requiresAdminApproval: true,
            }
          : undefined,
    });
  }

  return (
    <AppShell title="Paket seç" subtitle="Sana uygun paketi seç. Bir sonraki adımda bu pakete uygun eğitmenleri göreceksin." icon="package">
      <AnimatedEntrance>
        <IntakeProgressCard
          step={3}
          total={6}
          icon="package"
          eyebrow="Paket seçimi"
          title="Şimdi sana uygun paket yapısını netleştiriyoruz"
          description="Paket seçimi yalnızca fiyat kararı değil; ritim, toplam ders hakkı ve planlama esnekliğini birlikte belirler."
          badgeLabel={memberBookingDraft.salonName || "Salon seçildi"}
          badgeTone="success"
      summaryItems={[
            { label: "Salon", value: memberBookingDraft.salonName || "Henüz seçilmedi" },
            { label: "Ritim", value: memberIntent.weeklyDays || "Belirtilmedi" },
            { label: "Saat tercihi", value: memberIntent.timePreference || "Belirtilmedi" },
          ]}
          footnote="Bir paket seçtiğinde yalnız bu yapı için uygun eğitmen ve saat akışını görürsün."
        />
      </AnimatedEntrance>

      {availableFilters.length > 1 || availableModeFilters.length > 1 ? (
        <AnimatedEntrance delay={40}>
          <SurfaceCard>
            <View style={styles.filterHeader}>
              <View style={styles.filterCopy}>
                <Text style={styles.filterTitle}>Paket filtreleri</Text>
                <Text style={styles.filterDescription}>
                  {suggestedFilter === "ALL"
                    ? "Tüm paketleri görebilirsin. İstersen ders tipine göre listeyi daralt."
                    : `Onboarding cevabına göre ${FILTER_LABELS[suggestedFilter]} öne alındı, diğer paketleri de filtrelerle görebilirsin.`}
                </Text>
              </View>
              {suggestedFilter !== "ALL" ? <StatusBadge label={`Öneri: ${FILTER_LABELS[suggestedFilter]}`} tone="info" /> : null}
            </View>
            <View style={styles.filterRow}>
              {availableFilters.map((filterKey) => (
                <SelectionChip
                  key={filterKey}
                  label={FILTER_LABELS[filterKey]}
                  active={activeFilter === filterKey}
                  onPress={() => setActiveFilter(filterKey)}
                  testID={`intake-package-filter-${filterKey.toLowerCase()}`}
                />
              ))}
            </View>
            {availableModeFilters.length > 1 ? (
              <View style={styles.modeFilterBlock}>
                <Text style={styles.modeFilterTitle}>Ders akışı</Text>
                <View style={styles.filterRow}>
                  {availableModeFilters.map((filterKey) => (
                    <SelectionChip
                      key={filterKey}
                      label={MODE_FILTER_LABELS[filterKey]}
                      active={activeModeFilter === filterKey}
                      onPress={() => setActiveModeFilter(filterKey)}
                      testID={`intake-package-mode-filter-${filterKey.toLowerCase()}`}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </SurfaceCard>
        </AnimatedEntrance>
      ) : null}

      {packages.length === 0 ? (
        <EmptyState title="Şu anda seçilebilir paket yok" description="Bu salon için yayında bir paket bulunmuyor. Daha sonra tekrar kontrol edebilirsin." icon="package" />
      ) : filteredPackages.length === 0 ? (
        <EmptyState
          title="Bu filtrede paket görünmüyor"
          description="Önerilen ders tipinde aktif paket yok. Filtreyi değiştirip diğer paketleri inceleyebilirsin."
          icon="package"
        />
      ) : (
        filteredPackages.map((pkg: any, index: number) => (
          <AnimatedEntrance key={pkg.id} delay={80 + index * 70}>
            <SurfaceCard tone="primary" padding="hero">
              <Pressable
                testID={`intake-package-card-${index}`}
                accessibilityLabel={String(pkg.title || "")}
                onPress={() => togglePackageSelection(pkg)}
                style={({ pressed }) => [styles.cardPressable, pressed ? styles.cardPressablePressed : null]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.title}>{pkg.title}</Text>
                    {suggestedFilter !== "ALL" && resolvePackageFilters(pkg).includes(suggestedFilter) ? (
                      <StatusBadge label="Sana uygun olabilir" tone="success" />
                    ) : null}
                    {submittedPackageIds.has(String(pkg.id)) ? (
                      <StatusBadge label="Onaya gönderildi" tone="warning" />
                    ) : currentPackageId === String(pkg.id) ? (
                      <StatusBadge label="Sıradaki paket" tone="info" />
                    ) : selectedPackageIds.has(String(pkg.id)) ? (
                      <StatusBadge label="Seçildi" tone="neutral" />
                    ) : null}
                  </View>
                  <Text style={styles.price}>{pkg.display_price || "-"}</Text>
                </View>
                <Text style={styles.copy}>{pkg.summary || "Paketin ritmi, toplam ders hakkı ve planlama yapısı burada özetlenir."}</Text>
                <View style={styles.metaRow}>
                  <MetaPill icon="calendar" label={`${pkg.total_credits || 0} ders`} />
                  <MetaPill icon="clock" label={`Haftada ${pkg.weekly_class_hours || 1}`} />
                  <MetaPill icon="spark" label={`${pkg.session_duration_minutes || 45} dk`} />
                  {pkg.lesson_mode ? <MetaPill icon="package" label={formatLessonModeLabel(String(pkg.lesson_mode))} /> : null}
                </View>
                {Array.isArray(pkg.sub_lessons) && pkg.sub_lessons.length > 0 ? (
                  <Text style={styles.copy}>Alt dersler: {pkg.sub_lessons.join(", ")}</Text>
                ) : null}
              </Pressable>
              <ActionButton
                testID={`intake-package-toggle-${index}`}
                label={selectedPackageIds.has(String(pkg.id)) ? "Seçildi" : "Pakete ekle"}
                icon="package"
                variant={selectedPackageIds.has(String(pkg.id)) ? "ghost" : "primary"}
                onPress={() => togglePackageSelection(pkg)}
              />
            </SurfaceCard>
          </AnimatedEntrance>
        ))
      )}
      {selectedPackageIds.size > 0 ? (
        <ActionButton
          testID="intake-package-continue"
          label={selectedPackageIds.size > 1 ? `${selectedPackageIds.size} paketle devam et` : "Detaya geç"}
          icon="spark"
          onPress={() => {
            const nextPackage = findNextUnsubmittedPackage(memberBookingDraft) || rankedPackages.find((row: any) => selectedPackageIds.has(String(row.id)));
            if (!nextPackage) return;
            const nextDraft = applyCurrentPackageToDraft(memberBookingDraft, String(nextPackage.package_id || nextPackage.id));
            setMemberBookingDraft(nextDraft);
            router.push({
              pathname: "/(intake-member)/package-detail",
              params: {
                slug: String(params.slug),
                id: String(nextPackage.package_id || nextPackage.id),
                title: String(nextPackage.package_title || nextPackage.title || ""),
                price: String(nextPackage.package_price || nextPackage.display_price || ""),
                summary: String(nextPackage.summary || ""),
                credits: String(nextPackage.total_credits || ""),
                weeklyClassHours: String(nextPackage.weekly_class_hours || ""),
                requiredPreferenceSlots: String(nextPackage.required_preference_slots || ""),
                requiredTrainerFreeSlots: String(nextPackage.required_trainer_free_slots || ""),
                subLessons: Array.isArray((nextPackage as any).sub_lessons) ? (nextPackage as any).sub_lessons.join("||") : "",
              },
            } as never);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function deriveSuggestedFilter(memberIntent: { issue?: string; goal?: string; expectation?: string }): PackageFilterKey {
  const issue = String(memberIntent.issue || "").toLocaleLowerCase("tr-TR");
  const goal = String(memberIntent.goal || "").toLocaleLowerCase("tr-TR");
  const expectation = String(memberIntent.expectation || "").toLocaleLowerCase("tr-TR");
  const haystack = `${issue} ${goal} ${expectation}`;

  if (haystack.includes("skolyoz")) return "SCOLIOSIS";
  if (haystack.includes("grup")) return "GROUP";
  if (haystack.includes("birebir")) return "PT";
  if (haystack.includes("duruş") || haystack.includes("duruş")) return "PILATES";
  if (haystack.includes("reformer")) return "REFORMER";
  if (haystack.includes("bel") || haystack.includes("boyun") || haystack.includes("sırt") || haystack.includes("ağrı")) return "PT";
  return "ALL";
}

function resolvePackageMode(pkg: any): PackageModeFilterKey | null {
  const rawMode = String(pkg?.lesson_mode || "").trim().toUpperCase();
  if (rawMode === "SINGLE" || rawMode === "DUO" || rawMode === "GROUP") {
    return rawMode;
  }
  return null;
}

function formatLessonModeLabel(mode: string) {
  const normalized = mode.trim().toUpperCase();
  if (normalized === "SINGLE") return "Single";
  if (normalized === "DUO") return "Duo";
  if (normalized === "GROUP") return "Group";
  return mode;
}

function scorePackageForIntent(
  pkg: any,
  memberIntent: { issue?: string; goal?: string; expectation?: string; weeklyDays?: string },
  suggestedFilter: PackageFilterKey
) {
  let score = 0;
  const filters = resolvePackageFilters(pkg);
  const mode = resolvePackageMode(pkg);
  const title = String(pkg?.title || "").toLocaleLowerCase("tr-TR");
  const summary = String(pkg?.summary || "").toLocaleLowerCase("tr-TR");
  const haystack = `${title} ${summary}`;
  const issue = String(memberIntent.issue || "").toLocaleLowerCase("tr-TR");
  const goal = String(memberIntent.goal || "").toLocaleLowerCase("tr-TR");
  const expectation = String(memberIntent.expectation || "").toLocaleLowerCase("tr-TR");
  const weeklyDays = String(memberIntent.weeklyDays || "").toLocaleLowerCase("tr-TR");

  if (suggestedFilter !== "ALL" && filters.includes(suggestedFilter)) score += 100;
  if (expectation.includes("grup") && mode === "GROUP") score += 24;
  if (expectation.includes("birebir") && mode === "SINGLE") score += 24;
  if ((issue.includes("skolyoz") || goal.includes("duruş")) && filters.includes("SCOLIOSIS")) score += 32;
  if ((issue.includes("ağrı") || issue.includes("bel") || issue.includes("boyun") || issue.includes("sırt")) && filters.includes("PT")) score += 28;
  if (goal.includes("duruş") && (filters.includes("PILATES") || filters.includes("REFORMER"))) score += 20;
  if (goal.includes("düzenli") && filters.includes("GROUP")) score += 12;
  if (weeklyDays.includes("1 gün") && mode === "SINGLE") score += 8;
  if ((weeklyDays.includes("3 gün") || weeklyDays.includes("4+")) && mode === "GROUP") score += 8;
  if (haystack.includes("skolyoz")) score += issue.includes("skolyoz") ? 12 : 0;
  if (haystack.includes("reformer")) score += goal.includes("duruş") ? 6 : 0;
  if (haystack.includes("pilates")) score += goal.includes("duruş") ? 6 : 0;

  return score;
}

function resolvePackageFilters(pkg: any): PackageFilterKey[] {
  const title = String(pkg?.title || "").toLocaleLowerCase("tr-TR");
  const summary = String(pkg?.summary || "").toLocaleLowerCase("tr-TR");
  const type = String(pkg?.type || "").toUpperCase();
  const subLessons = Array.isArray(pkg?.sub_lessons) ? pkg.sub_lessons.map((row: string) => String(row).toLocaleLowerCase("tr-TR")) : [];
  const keys = new Set<PackageFilterKey>();

  if (type === "GROUP" || title.includes("grup")) keys.add("GROUP");
  if (type === "PT" || title.includes("pt") || title.includes("bireysel")) keys.add("PT");
  if (type === "SCOLIOSIS" || title.includes("skolyoz") || summary.includes("skolyoz")) keys.add("SCOLIOSIS");
  if (type === "REFORMER" || title.includes("reformer") || subLessons.some((row: string) => row.includes("reformer"))) keys.add("REFORMER");
  if (title.includes("pilates") || subLessons.some((row: string) => row.includes("pilates")) || summary.includes("pilates")) keys.add("PILATES");

  if (keys.size === 0) {
    if (String(pkg?.lesson_mode || "").toUpperCase() === "GROUP") {
      keys.add("GROUP");
    } else {
      keys.add("PT");
    }
  }

  return Array.from(keys);
}

function MetaPill({ icon, label }: { icon: "calendar" | "clock" | "spark" | "package"; label: string }) {
  return (
    <View style={styles.metaPill}>
      <AppIcon name={icon} size="sm" tone="primary" />
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.semibold,
  },
  price: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  filterHeader: {
    gap: tokens.spacing.sm,
  },
  filterCopy: {
    gap: tokens.spacing.xs,
  },
  filterTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  filterDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  modeFilterBlock: {
    gap: tokens.spacing.sm,
  },
  modeFilterTitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  cardPressable: {
    gap: tokens.spacing.sm,
  },
  cardPressablePressed: {
    opacity: 0.96,
  },
});
