import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  getMemberHomeApi,
  getMemberAttendanceHistoryApi,
  getMemberMyPackagesApi,
  getPublicSalonPackagesApi,
  type MemberAttendanceHistoryItem,
  type MemberOwnedPackage,
} from "@/lib/mobile-api";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type PackageTab = "PACKAGES" | "HISTORY" | "PAYMENTS";

type PublicPackageRow = {
  id?: string;
  title?: string;
  summary?: string;
  type?: string | null;
  lesson_category?: string | null;
  service_key?: string | null;
  service_name?: string | null;
  rules?: Record<string, unknown> | null;
  display_price?: string | number | null;
  total_credits?: string | number | null;
  weekly_class_hours?: string | number | null;
  required_preference_slots?: string | number | null;
  required_trainer_free_slots?: string | number | null;
  lesson_mode?: string | null;
  allow_drop_in_booking?: boolean | null;
  sub_lessons?: string[] | null;
};

function unwrapArray<T>(payload: T[] | { data?: T[] } | undefined | null): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatDateTime(value?: string | null) {
  if (!value) return "Belirtilmedi";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Belirtilmedi"
    : date.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("tr-TR");
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Bedelsiz";

  const amount = Number(value);

  return Number.isFinite(amount) ? `₺${amount.toLocaleString("tr-TR")}` : "Bedelsiz";
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeStatus(value?: string | null) {
  return String(value || "").toUpperCase();
}

function isActiveOwnedPackage(pkg: MemberOwnedPackage) {
  const status = normalizeStatus(pkg.status);
  const remaining = toNumber(pkg.remaining_credits);

  return status === "ACTIVE" || remaining > 0;
}

function attendanceStatus(item: MemberAttendanceHistoryItem) {
  const result = normalizeStatus(item.result);

  if (result === "CHECKED_IN" || result === "CREDIT_DEDUCTED" || result === "COMPLETED") {
    return { label: "Katıldı", tone: "success" as const };
  }

  if (result === "NO_CREDIT") {
    return { label: "Hak yok", tone: "warning" as const };
  }

  if (result === "PACKAGE_EXPIRED") {
    return { label: "Paket süresi dolmuş", tone: "warning" as const };
  }

  if (result === "USER_INACTIVE") {
    return { label: "Üyelik pasif", tone: "warning" as const };
  }

  if (result === "SESSION_NOT_FOUND") {
    return { label: "Ders bulunamadı", tone: "neutral" as const };
  }

  return { label: "İşlenemedi", tone: "neutral" as const };
}

function isSuccessfulAttendance(item: MemberAttendanceHistoryItem) {
  return attendanceStatus(item).tone === "success";
}

function attendanceCreditText(item: MemberAttendanceHistoryItem) {
  const deducted = toNumber((item as { credits_deducted?: string | number | null }).credits_deducted);

  if (deducted > 0) return `${deducted} hak düşüldü`;

  const result = normalizeStatus(item.result);

  if (result === "NO_CREDIT") return "Hak düşmedi • kredi yok";
  if (result === "PACKAGE_EXPIRED") return "Hak düşmedi • paket süresi dolmuş";
  if (result === "USER_INACTIVE") return "Hak düşmedi • üyelik pasif";
  if (result === "SESSION_NOT_FOUND") return "Hak düşmedi • ders bulunamadı";

  return "Hak düşmedi";
}

function attendanceSubtitle(item: MemberAttendanceHistoryItem) {
  const trainerName = String((item as { trainer_full_name?: string | null }).trainer_full_name || "").trim();
  const packageName = String(
    (item as { package_title?: string | null; package_name?: string | null }).package_title ||
      (item as { package_name?: string | null }).package_name ||
      ""
  ).trim();

  const parts = [trainerName || "Eğitmen bilgisi yok", packageName || "Paket bilgisi yok"];

  return parts.join(" • ");
}

function attendanceDate(item: MemberAttendanceHistoryItem) {
  return (
    item.created_at ||
    (item as { checked_in_at?: string | null }).checked_in_at ||
    (item as { starts_at?: string | null }).starts_at ||
    null
  );
}

function isThisMonth(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function statusMeta(pkg: MemberOwnedPackage) {
  const status = normalizeStatus(pkg.status);

  if (status === "UPCOMING") {
    return {
      label: "Yakında başlayacak",
      tone: "info" as const,
      helper: `Başlangıç: ${formatDate(pkg.starts_at || pkg.created_at)}`,
    };
  }

  if (status === "EXPIRED") {
    return {
      label: "Tamamlandı",
      tone: "neutral" as const,
      helper: `Bitiş: ${formatDate(pkg.expires_at)}`,
    };
  }

  if (status === "AWAITING_PARTNER_PAYMENT") {
    return {
      label: "Partner bekleniyor",
      tone: "warning" as const,
      helper: "Partner daveti ve kalan ödeme tamamlanınca aktifleşir",
    };
  }

  return {
    label: "Kullanımda",
    tone: "success" as const,
    helper: `Geçerlilik sonu: ${formatDate(pkg.expires_at)}`,
  };
}

function normalizeMatchText(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function packageTestId(value: unknown) {
  return normalizeMatchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function publicPackageSearchText(pkg: PublicPackageRow) {
  const rules = pkg.rules && typeof pkg.rules === "object" ? pkg.rules : {};
  const subLessons = Array.isArray(pkg.sub_lessons) ? pkg.sub_lessons : Array.isArray(rules.sub_lessons) ? rules.sub_lessons : [];
  return normalizeMatchText(
    [
      pkg.title,
      pkg.summary,
      pkg.type,
      pkg.lesson_category,
      pkg.service_key,
      pkg.service_name,
      rules.lesson_category,
      rules.service_key,
      rules.service_name,
      rules.category_group,
      ...subLessons,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function scorePublicPackageForIntent(
  pkg: PublicPackageRow,
  intent: { issue?: string; goal?: string; expectation?: string; weeklyDays?: string }
) {
  const text = publicPackageSearchText(pkg);
  const issue = normalizeMatchText(intent.issue);
  const goal = normalizeMatchText(intent.goal);
  const expectation = normalizeMatchText(intent.expectation);
  const weeklyDays = normalizeMatchText(intent.weeklyDays);
  const mode = String(pkg.lesson_mode || "").toUpperCase();
  let score = 0;

  if ((issue.includes("skolyoz") || goal.includes("skolyoz")) && text.includes("skolyoz")) score += 40;
  if ((issue.includes("cocuk") || goal.includes("cocuk") || issue.includes("pediatrik")) && (text.includes("cocuk") || text.includes("pediatrik"))) score += 36;
  if ((issue.includes("bel") || issue.includes("boyun") || issue.includes("sirt") || issue.includes("agri")) && (text.includes("bel") || text.includes("boyun") || text.includes("manuel") || text.includes("rehab"))) score += 34;
  if ((goal.includes("performans") || issue.includes("sporcu") || goal.includes("antrenman")) && (text.includes("sporcu") || text.includes("performans") || text.includes("antrenman"))) score += 30;
  if ((goal.includes("durus") || issue.includes("postur")) && (text.includes("postur") || text.includes("pilates") || text.includes("reformer"))) score += 24;
  if ((issue.includes("gebe") || issue.includes("dogum")) && (text.includes("gebe") || text.includes("dogum"))) score += 28;
  if (expectation.includes("grup") && mode === "GROUP") score += 18;
  if ((expectation.includes("birebir") || expectation.includes("ozel")) && mode === "PRIVATE") score += 18;
  if ((weeklyDays.includes("3") || weeklyDays.includes("4")) && mode === "GROUP") score += 8;
  if (weeklyDays.includes("1") && mode === "PRIVATE") score += 8;

  return score;
}

export default function MemberPackageScreen() {
  const router = useRouter();
  const { activeMembership } = useSession();
  const { memberBookingDraft, memberIntent, setMemberBookingDraft } = useAppFlow();

  const [tab, setTab] = useState<PackageTab>("PACKAGES");

  const homeQuery = useQuery({
    queryKey: ["member-package-summary"],
    queryFn: getMemberHomeApi,
  });

  const packagesListQuery = useQuery({
    queryKey: ["member-my-packages-list"],
    queryFn: getMemberMyPackagesApi,
  });

  const publicPackagesQuery = useQuery({
    queryKey: ["member-renewal-public-packages", activeMembership?.tenant_slug],
    queryFn: () => getPublicSalonPackagesApi(String(activeMembership?.tenant_slug)),
    enabled: Boolean(activeMembership?.tenant_slug),
  });

  const historyQuery = useQuery({
    queryKey: ["member-attendance-history"],
    queryFn: getMemberAttendanceHistoryApi,
  });

  const allPurchasedPackages = unwrapArray<MemberOwnedPackage>(
    packagesListQuery.data as MemberOwnedPackage[] | { data?: MemberOwnedPackage[] } | undefined
  );

  const publicPackages = unwrapArray<PublicPackageRow>(
    publicPackagesQuery.data as PublicPackageRow[] | { data?: PublicPackageRow[] } | undefined
  );

  const attendanceHistory = unwrapArray<MemberAttendanceHistoryItem>(
    historyQuery.data as MemberAttendanceHistoryItem[] | { data?: MemberAttendanceHistoryItem[] } | undefined
  );

  const ownedPackageIds = new Set(
    allPurchasedPackages
      .map((pkg) => String(pkg.package_id || ""))
      .filter(Boolean)
  );

  const purchasablePackages = publicPackages.filter((pkg) => !ownedPackageIds.has(String(pkg.id || "")));
  const recommendedPurchasablePackageId = useMemo(() => {
    const ranked = purchasablePackages
      .map((pkg) => ({ pkg, score: scorePublicPackageForIntent(pkg, memberIntent) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score > 0 ? String(ranked[0].pkg.id || "") : "";
  }, [memberIntent, purchasablePackages]);
  const activePackages = allPurchasedPackages.filter(isActiveOwnedPackage);

  const usage = homeQuery.data?.lesson_usage || {};
  const summaryRemaining = toNumber(usage.remaining_total_credits);

  const packageRemainingTotal = activePackages.reduce((sum, pkg) => {
    return sum + toNumber(pkg.remaining_credits);
  }, 0);

  const totalRemaining = allPurchasedPackages.length > 0 ? packageRemainingTotal : summaryRemaining;

  const successfulHistoryCount = attendanceHistory.filter(isSuccessfulAttendance).length;
  const thisMonthHistoryCount = attendanceHistory.filter((item) => {
    return isSuccessfulAttendance(item) && isThisMonth(attendanceDate(item));
  }).length;

  const refreshing =
    homeQuery.isRefetching ||
    historyQuery.isRefetching ||
    packagesListQuery.isRefetching ||
    publicPackagesQuery.isRefetching;

  async function handleRefresh() {
    await Promise.all([
      homeQuery.refetch(),
      historyQuery.refetch(),
      packagesListQuery.refetch(),
      publicPackagesQuery.refetch(),
    ]);
  }

  function handleRenewPackage(pkg: MemberOwnedPackage) {
    if (!activeMembership?.tenant_slug) {
      Alert.alert("Yenileme açılamadı", "Salon bilgisi bulunamadı.");
      return;
    }

    const matchedPackage = publicPackages.find((row) => String(row.id) === String(pkg.package_id || ""));

    if (!matchedPackage) {
      Alert.alert(
        "Paket bulunamadı",
        "Bu paketin güncel katalog kaydı görünmüyor. Salon paket listesinden devam edebilirsin."
      );

      router.push({
        pathname: "/(intake-member)/packages",
        params: { slug: String(activeMembership.tenant_slug) },
      } as never);

      return;
    }

    setMemberBookingDraft({
      ...memberBookingDraft,
      salonSlug: String(activeMembership.tenant_slug),
      salonName: activeMembership.tenant_name || memberBookingDraft.salonName || "",
      packageId: String(matchedPackage.id),
      packageIds: [String(matchedPackage.id)],
      selectedPackages: [
        {
          package_id: String(matchedPackage.id),
          package_title: String(matchedPackage.title || ""),
          package_price: String(matchedPackage.display_price || ""),
          lesson_mode: String(matchedPackage.lesson_mode || ""),
          weekly_class_hours: Number(matchedPackage.weekly_class_hours || 0),
          required_preference_slots: Number(matchedPackage.required_preference_slots || 0),
          required_trainer_free_slots: Number(matchedPackage.required_trainer_free_slots || 0),
          preferred_slots: [],
          weekly_frequency: undefined,
        },
      ],
      lessonMode: String(matchedPackage.lesson_mode || ""),
      allowDropInBooking: Boolean(matchedPackage.allow_drop_in_booking),
      selectedSubLesson: "",
      packageTitle: String(matchedPackage.title || ""),
      packagePrice: String(matchedPackage.display_price || ""),
      packageSummary: String(matchedPackage.summary || ""),
      weeklyClassHours: Number(matchedPackage.weekly_class_hours || 0),
      requiredPreferenceSlots: Number(matchedPackage.required_preference_slots || 0),
      requiredTrainerFreeSlots: Number(matchedPackage.required_trainer_free_slots || 0),
      trainerId: "",
      trainerName: "",
      preferredSlots: [],
      weeklyFrequency: undefined,
      groupClassFlow:
        Boolean(matchedPackage.allow_drop_in_booking) ||
        String(matchedPackage.lesson_mode || "").toUpperCase() === "GROUP"
          ? {
              selectedLessonName: "",
              selectedGroupClassId: "",
              notificationScope: "SALON_MEMBERS",
              requiresAdminApproval: true,
            }
          : undefined,
    });

    router.push({
      pathname: "/(intake-member)/package-detail",
      params: {
        slug: String(activeMembership.tenant_slug),
        id: String(matchedPackage.id),
        title: String(matchedPackage.title || ""),
        price: String(matchedPackage.display_price || ""),
        summary: String(matchedPackage.summary || ""),
        credits: String(matchedPackage.total_credits || ""),
        weeklyClassHours: String(matchedPackage.weekly_class_hours || ""),
        requiredPreferenceSlots: String(matchedPackage.required_preference_slots || ""),
        requiredTrainerFreeSlots: String(matchedPackage.required_trainer_free_slots || ""),
        subLessons: Array.isArray(matchedPackage.sub_lessons) ? matchedPackage.sub_lessons.join("||") : "",
      },
    } as never);
  }

  function handleBuyAnotherPackage(pkg: PublicPackageRow) {
    if (!activeMembership?.tenant_slug) {
      Alert.alert("Satın alma açılamadı", "Salon bilgisi bulunamadı.");
      return;
    }

    setMemberBookingDraft({
      ...memberBookingDraft,
      salonSlug: String(activeMembership.tenant_slug),
      salonName: activeMembership.tenant_name || memberBookingDraft.salonName || "",
      packageId: String(pkg.id),
      packageIds: [String(pkg.id)],
      currentPackageId: String(pkg.id),
      submittedPackageIds: [],
      selectedPackages: [
        {
          package_id: String(pkg.id),
          package_title: String(pkg.title || ""),
          package_price: String(pkg.display_price || ""),
          total_credits: Number(pkg.total_credits || 0),
          lesson_mode: String(pkg.lesson_mode || ""),
          weekly_class_hours: Number(pkg.weekly_class_hours || 0),
          required_preference_slots: Number(pkg.required_preference_slots || 0),
          required_trainer_free_slots: Number(pkg.required_trainer_free_slots || 0),
          preferred_slots: [],
          weekly_frequency: Number(pkg.weekly_class_hours || 0),
          trainer_id: "",
          trainer_name: "",
          selected_sub_lesson: "",
        },
      ],
      lessonMode: String(pkg.lesson_mode || ""),
      allowDropInBooking: Boolean(pkg.allow_drop_in_booking),
      selectedSubLesson: "",
      packageTitle: String(pkg.title || ""),
      packagePrice: String(pkg.display_price || ""),
      packageSummary: String(pkg.summary || ""),
      weeklyClassHours: Number(pkg.weekly_class_hours || 0),
      requiredPreferenceSlots: Number(pkg.required_preference_slots || 0),
      requiredTrainerFreeSlots: Number(pkg.required_trainer_free_slots || 0),
      trainerId: "",
      trainerName: "",
      preferredSlots: [],
      weeklyFrequency: Number(pkg.weekly_class_hours || 0),
      note: memberBookingDraft.note,
      groupClassFlow:
        Boolean(pkg.allow_drop_in_booking) || String(pkg.lesson_mode || "").toUpperCase() === "GROUP"
          ? {
              selectedLessonName: "",
              selectedGroupClassId: "",
              notificationScope: "SALON_MEMBERS",
              requiresAdminApproval: true,
            }
          : undefined,
    });

    router.push({
      pathname: "/(intake-member)/package-detail",
      params: {
        slug: String(activeMembership.tenant_slug),
        id: String(pkg.id),
        title: String(pkg.title || ""),
        price: String(pkg.display_price || ""),
        summary: String(pkg.summary || ""),
        credits: String(pkg.total_credits || ""),
        weeklyClassHours: String(pkg.weekly_class_hours || ""),
        requiredPreferenceSlots: String(pkg.required_preference_slots || ""),
        requiredTrainerFreeSlots: String(pkg.required_trainer_free_slots || ""),
        subLessons: Array.isArray(pkg.sub_lessons) ? pkg.sub_lessons.join("||") : "",
      },
    } as never);
  }

  const renderUsageProgress = (pkg: MemberOwnedPackage) => {
    const total = toNumber(pkg.package_total_credits ?? pkg.total_credits);
    const remaining = toNumber(pkg.remaining_credits);
    const safeTotal = Math.max(total, remaining, 0);
    const used = Math.max(0, safeTotal - remaining);
    const percentage = safeTotal > 0 ? Math.min(100, (used / safeTotal) * 100) : 0;
    const isAlmostDone = percentage >= 80;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Kullanılan: %{Math.round(percentage)}</Text>
          <Text style={styles.progressHint}>
            {remaining} hak kaldı • {used}/{safeTotal} kullanıldı
          </Text>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${percentage}%` },
              isAlmostDone ? styles.progressBarFillDanger : null,
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <AppShell
      testID="member-package-screen"
      title="Paket ve Geçmiş"
      subtitle="Paketlerini, kullanım durumunu ve ödeme geçmişini tek ekranda takip et."
      icon="package"
      refreshing={refreshing}
      onRefresh={() => {
        handleRefresh().catch(() => null);
      }}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Aktif Paket" value={activePackages.length} icon="package" />
        <MetricCard testID={`member-package-total-remaining-${totalRemaining}`} label="Toplam Hak" value={totalRemaining} icon="ticket" />
      </View>

      {activeMembership?.tenant_slug ? (
        <SurfaceCard tone="primary">
          <Text style={styles.sectionTitle}>Aynı üyelikte yeni paket alabilir veya aktif paketini yenileyebilirsin</Text>
          <Text style={styles.copy}>
            Yeni hesap açman gerekmez. Admin onayı sonrası yeni paketin hakları mevcut üyeliğine eklenir ve eğitmen planlaması aynı takvim akışında devam eder.
          </Text>
          <ActionButton
            testID="member-open-salon-packages"
            label="Diğer paketleri gör"
            icon="package"
            onPress={() =>
              router.push({
                pathname: "/(intake-member)/packages",
                params: { slug: String(activeMembership.tenant_slug) },
              } as never)
            }
          />
        </SurfaceCard>
      ) : null}

      <SegmentedSwitch
        value={tab}
        options={[
          { label: "Paketlerim", value: "PACKAGES" },
          { label: "Geçmiş", value: "HISTORY" },
          { label: "Ödemeler", value: "PAYMENTS" },
        ]}
        onChange={(val) => setTab(val as PackageTab)}
      />

      {tab === "PACKAGES" ? (
        <View style={styles.sectionStack}>
          <SurfaceCard>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Paketlerim</Text>
              <StatusBadge label={`${allPurchasedPackages.length} satın alım`} tone="info" />
            </View>

            {allPurchasedPackages.length === 0 ? (
              <EmptyState
                title="Paket görünmüyor"
                description="Henüz satın alınmış paket kaydın görünmüyor. Yeni paket almak için salon listesini açabilirsin."
                icon="package"
              />
            ) : (
              <ScrollPanel maxHeight={420}>
                {allPurchasedPackages.map((pkg, packageIndex) => {
                  const meta = statusMeta(pkg);
                  const remaining = toNumber(pkg.remaining_credits);
                  const linkedGroupClasses = Array.isArray(pkg.linked_group_classes)
                    ? pkg.linked_group_classes
                    : [];

                  return (
                    <View key={pkg.id} style={styles.listCard}>
                      <View style={styles.inlineBetween}>
                        <View style={styles.grow}>
                          <Text style={styles.title}>{pkg.package_title || "Aktif Paket"}</Text>
                          <Text style={styles.copy}>{pkg.lesson_category_label || "Genel Ders"}</Text>

                          {pkg.latest_catalog_price ? (
                            <Text style={styles.copy}>Güncel paket fiyatı: {formatCurrency(pkg.latest_catalog_price)}</Text>
                          ) : null}

                          {pkg.renewal_price_changed ? (
                            <Text style={styles.priceWarning}>
                              Önceki ödeme: {formatCurrency(pkg.package_price)} • Yenileme tutarı:{" "}
                              {formatCurrency(pkg.renewal_price)}
                            </Text>
                          ) : null}
                        </View>

                        <StatusBadge label={meta.label} tone={meta.tone} />
                      </View>

                      {normalizeStatus(pkg.status) === "ACTIVE" ? renderUsageProgress(pkg) : null}

                      {pkg.is_duo || pkg.duo_status ? (
                        <View style={styles.linkedGroupBox}>
                          <Text style={styles.linkedGroupTitle}>Duo partner akışı</Text>
                          <Text style={styles.copy}>Partner: {pkg.duo_partner_name || "Davet bekleniyor"}</Text>
                          <Text style={styles.copy}>Durum: {pkg.duo_status || pkg.duo_payment_status || "Partner ödemesi bekleniyor"}</Text>
                          {pkg.duo_invite_url ? <Text style={styles.copy}>Davet linki: {pkg.duo_invite_url}</Text> : null}
                        </View>
                      ) : null}

                      <View style={styles.packageMetaRow}>
                        <View style={styles.metaPill}>
                          <AppIcon name="ticket" size="sm" tone="neutral" />
                          <Text style={styles.hint}>{remaining} hak kaldı</Text>
                        </View>

                        <View style={styles.metaPill}>
                          <AppIcon name="calendar" size="sm" tone="neutral" />
                          <Text style={styles.hint}>{meta.helper}</Text>
                        </View>
                      </View>

                      {linkedGroupClasses.length > 0 ? (
                        <View style={styles.linkedGroupBox}>
                          <Text style={styles.linkedGroupTitle}>Bağlı grup dersleri</Text>

                          {linkedGroupClasses.slice(0, 3).map((item) => {
                            const itemStatus = normalizeStatus(item.status);
                            const isPending = itemStatus === "PENDING";

                            return (
                              <View key={String(item.id || item.session_id)} style={styles.linkedGroupRow}>
                                <View style={styles.grow}>
                                  <Text style={styles.linkedGroupName}>{String(item.title || "Grup dersi")}</Text>
                                  <Text style={styles.linkedGroupMeta}>
                                    {formatDateTime(item.starts_at)} • {isPending ? "Onay bekliyor" : "Onaylandı"}
                                  </Text>
                                </View>

                                <StatusBadge
                                  label={isPending ? "Bekliyor" : "Aktif"}
                                  tone={isPending ? "warning" : "success"}
                                />
                              </View>
                            );
                          })}

                          {linkedGroupClasses.length > 3 ? (
                            <Text style={styles.linkedGroupMore}>+{linkedGroupClasses.length - 3} ders daha</Text>
                          ) : null}
                        </View>
                      ) : null}

                      {pkg.package_id ? (
                        <ActionButton
                          testID={`member-renew-package-${packageTestId(pkg.package_title || packageIndex)}`}
                          label={`Bu paketi ${formatCurrency(
                            pkg.renewal_price ?? pkg.latest_catalog_price ?? pkg.package_price
                          )} ile yenile`}
                          icon="wallet"
                          variant="ghost"
                          onPress={() => handleRenewPackage(pkg)}
                          disabled={!activeMembership?.tenant_slug || publicPackagesQuery.isLoading}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ScrollPanel>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Diğer Paketler</Text>
              <StatusBadge label={`${purchasablePackages.length} seçenek`} tone="info" />
            </View>

            {purchasablePackages.length === 0 ? (
              <EmptyState
                title="Görünür ek paket yok"
                description="Şu an katalogda sana ayrıca gösterilebilecek başka paket görünmüyor."
                icon="package"
              />
            ) : (
              <View style={styles.invoiceList}>
                {purchasablePackages.slice(0, 3).map((pkg, index) => {
                  const isRecommended = recommendedPurchasablePackageId === String(pkg.id || "");
                  return (
                  <View key={String(pkg.id)} style={[styles.listCard, isRecommended ? styles.recommendedPackageCard : null]}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.grow}>
                        <View style={styles.titleBadgeRow}>
                          <Text style={styles.title}>{String(pkg.title || "Paket")}</Text>
                          {isRecommended ? <StatusBadge label="Sana özel" tone="success" /> : null}
                        </View>
                        <Text style={styles.copy}>
                          {String(pkg.summary || "Bu paketi aynı üyelik altında satın alabilirsin.")}
                        </Text>
                      </View>
                      <Text style={styles.invoiceAmount}>{formatCurrency(pkg.display_price)}</Text>
                    </View>

                    <View style={styles.packageMetaRow}>
                      <View style={styles.metaPill}>
                        <AppIcon name="ticket" size="sm" tone="neutral" />
                        <Text style={styles.hint}>{toNumber(pkg.total_credits)} hak</Text>
                      </View>

                      <View style={styles.metaPill}>
                        <AppIcon name="calendar" size="sm" tone="neutral" />
                        <Text style={styles.hint}>{toNumber(pkg.weekly_class_hours)} haftalık ders hedefi</Text>
                      </View>
                    </View>

                    <ActionButton testID={`member-buy-additional-package-${index}`} label="Bu paketi satın al" icon="package" onPress={() => handleBuyAnotherPackage(pkg)} />
                  </View>
                );
                })}

                {purchasablePackages.length > 3 ? (
                  <ActionButton
                    label="Tüm paketleri aç"
                    icon="spark"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: "/(intake-member)/packages",
                        params: { slug: String(activeMembership?.tenant_slug || "") },
                      } as never)
                    }
                  />
                ) : null}
              </View>
            )}
          </SurfaceCard>
        </View>
      ) : null}

      {tab === "HISTORY" ? (
        <SurfaceCard>
          <View style={styles.sectionHeader}>
            <View style={styles.grow}>
              <Text style={styles.sectionTitle}>Ders geçmişi</Text>
              <Text style={styles.copy}>
                Toplam {attendanceHistory.length} kayıt • Bu ay {thisMonthHistoryCount} katılım •{" "}
                {successfulHistoryCount} başarılı check-in
              </Text>
            </View>
          </View>

          {attendanceHistory.length === 0 ? (
            <EmptyState
              title="Ders geçmişi yok"
              description="Check-in yapıldığında ders katılım kayıtların burada görünecek."
              icon="calendar"
            />
          ) : (
            <ScrollPanel maxHeight={480}>
              {attendanceHistory.map((item) => {
                const status = attendanceStatus(item);
                const statusIcon = status.tone === "success" ? "checkin" : status.tone === "warning" ? "risk" : "calendar";

                return (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyIcon}>
                      <AppIcon name={statusIcon} size="sm" tone={status.tone} />
                    </View>

                    <View style={styles.grow}>
                      <Text style={styles.itemTitle}>{item.session_title || "Antrenman"}</Text>
                      <Text style={styles.copy}>{attendanceSubtitle(item)}</Text>
                      <Text style={styles.historyMeta}>{formatDateTime(attendanceDate(item))}</Text>
                      <Text style={styles.historyMeta}>{attendanceCreditText(item)}</Text>
                    </View>

                    <StatusBadge label={status.label} tone={status.tone} />
                  </View>
                );
              })}
            </ScrollPanel>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "PAYMENTS" ? (
        <SurfaceCard>
          <Text style={styles.sectionTitle}>Ödeme geçmişi</Text>

          {allPurchasedPackages.length === 0 ? (
            <EmptyState title="Kayıt bulunamadı" description="Henüz görüntülenecek bir ödeme kaydın yok." icon="wallet" />
          ) : (
            <View style={styles.invoiceList}>
              {allPurchasedPackages.map((pkg) => (
                <View key={pkg.id} style={styles.invoiceItem}>
                  <View style={styles.invoiceIcon}>
                    <AppIcon name="wallet" size="sm" tone="primary" />
                  </View>

                  <View style={styles.grow}>
                    <Text style={styles.invoiceTitle}>{pkg.package_title || "Paket Alımı"}</Text>
                    <Text style={styles.invoiceDate}>{formatDate(pkg.starts_at || pkg.created_at)}</Text>

                    {pkg.latest_catalog_price ? (
                      <Text style={styles.invoiceDate}>Güncel paket fiyatı: {formatCurrency(pkg.latest_catalog_price)}</Text>
                    ) : null}
                  </View>

                  <View style={styles.invoiceRight}>
                    <Text style={styles.invoiceAmount}>{formatCurrency(pkg.package_price)}</Text>
                    <Text style={styles.invoiceMeta}>
                      {normalizeStatus(pkg.status) === "ACTIVE"
                        ? "Aktif paket"
                        : normalizeStatus(pkg.status) === "UPCOMING"
                          ? "Yakında başlayacak"
                          : "Tamamlandı"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SurfaceCard>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sectionStack: {
    gap: tokens.spacing.md,
  },
  listCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  recommendedPackageCard: {
    borderColor: tokens.colors.success,
    backgroundColor: "#F4FBF7",
  },
  titleBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  priceWarning: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  sectionTitle: {
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    color: tokens.colors.text,
  },
  progressContainer: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  progressLabel: {
    fontSize: tokens.font.xs,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamily.medium,
  },
  progressHint: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "right",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: tokens.colors.primary,
    borderRadius: 4,
  },
  progressBarFillDanger: {
    backgroundColor: tokens.colors.danger,
  },
  packageMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  hint: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.medium,
  },
  linkedGroupBox: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  linkedGroupTitle: {
    fontSize: tokens.font.xs,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamily.semibold,
  },
  linkedGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  linkedGroupName: {
    fontSize: tokens.font.sm,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamily.semibold,
  },
  linkedGroupMeta: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.regular,
  },
  linkedGroupMore: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.medium,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.sm,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  itemTitle: {
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    color: tokens.colors.text,
  },
  historyMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  invoiceList: {
    gap: tokens.spacing.sm,
  },
  invoiceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    gap: tokens.spacing.sm,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  invoiceTitle: {
    fontSize: tokens.font.sm,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamily.semibold,
  },
  invoiceDate: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.regular,
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  invoiceAmount: {
    fontSize: tokens.font.sm,
    color: tokens.colors.text,
    fontFamily: tokens.fontFamily.bold,
  },
  invoiceMeta: {
    fontSize: tokens.font.xs,
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.medium,
  },
});
