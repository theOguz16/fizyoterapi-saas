import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  getAdminBookingsApi,
  getAdminMemberAttendanceApi,
  getAdminMemberDetailApi,
  getAdminMemberMeaşurementsApi,
  getAdminPackageAssignmentsApi,
  getAdminMemberRetentionApi,
  getAdminTrainerDetailApi,
  getAdminTrainerEarningsApi,
  getAdminTrainerSkillsApi,
  type AdminTrainerEarnings,
  type AdminPackageAssignment,
} from "@/lib/mobile-api";
import { buildTrainerSummary, getRetentionReasons, type TrainerBookingInsight } from "@/lib/admin-trainer-insights";
import { summarizeSignupOnboarding } from "@/lib/signup-onboarding";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyState } from "@/theme/components/empty-state";
import { MetricCard } from "@/theme/components/metric-card";
import { OnboardingSummaryCard } from "@/theme/components/onboarding-summary-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { bookingStatusLabel, packageTypeLabel } from "@/lib/labels";

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(value?: string | null) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Belirtilmedi" : date.toLocaleDateString("tr-TR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Belirtilmedi" : date.toLocaleString("tr-TR");
}

function formatCurrency(value?: number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMetricValue(value: string | number | null | undefined, unit?: string, prefix = false) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  const text = numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
  if (!unit) return text;
  return prefix ? `${unit}${text}` : `${text} ${unit}`;
}

function roleLabel(role?: string | null) {
  return role === "TRAINER" ? "Eğitmen" : "Üye";
}

function buildTrainerLessonChips(assignments: AdminPackageAssignment[]) {
  const labels = assignments
    .filter((item) => item?.is_active !== false && item?.package_is_active !== false && item?.trainer_is_active !== false)
    .map((item) => {
      const lessonName = String(
        item.package_service_name ||
          item.package_title ||
          item.package_lesson_category ||
          item.package_capacity_label ||
          ""
      ).trim();
      const typeLabel = packageTypeLabel(item.package_type);
      if (lessonName && typeLabel !== "-" && typeLabel !== lessonName) return `${lessonName} • ${typeLabel}`;
      return lessonName || typeLabel;
    })
    .filter((label) => label && label !== "-");

  return Array.from(new Set(labels));
}

type AttendanceItem = {
  id?: string;
  starts_at?: string | null;
  date?: string | null;
  created_at?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
  status?: string | null;
  trainer_full_name?: string | null;
  package_name?: string | null;
  package_title?: string | null;
};

type MeasurementItem = {
  id?: string;
  measured_at?: string | null;
  date?: string | null;
  weight_kg?: string | number | null;
  fat_percent?: string | number | null;
  muscle_kg?: string | number | null;
  muscle_percent?: string | number | null;
  height_cm?: string | number | null;
};

type RetentionItem = {
  score?: string | number | null;
  level?: string | null;
  breakdown?: { reasons?: unknown[] } | null;
  reason?: unknown;
  primary_reason?: unknown;
  reasom?: unknown;
  primary_reasom?: unknown;
};

export default function AdminMemberDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; role?: string; backTo?: string | string[] }>();
  const [tab, setTab] = useState("GENERAL");
  const requestedRole = String(params.role || "").toUpperCase();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const detailQuery = useQuery({
    queryKey: ["admin-person-detail", params.id, requestedRole],
    queryFn: async () => {
      if (requestedRole === "TRAINER") return getAdminTrainerDetailApi(String(params.id));
      if (requestedRole === "MEMBER") return getAdminMemberDetailApi(String(params.id));

      const member = await getAdminMemberDetailApi(String(params.id)).catch(() => null);
      if (member) return member;
      return getAdminTrainerDetailApi(String(params.id));
    },
  });

  const person = detailQuery.data || null;
  const entityRole = person?.role === "TRAINER" ? "TRAINER" : "MEMBER";

  const retentionQuery = useQuery({
    queryKey: ["admin-member-retention", params.id],
    queryFn: () => getAdminMemberRetentionApi(String(params.id)),
    enabled: entityRole === "MEMBER",
  });
  const attendanceQuery = useQuery({
    queryKey: ["admin-member-attendance", params.id],
    queryFn: () => getAdminMemberAttendanceApi(String(params.id)),
    enabled: entityRole === "MEMBER",
  });
  const measurementsQuery = useQuery({
    queryKey: ["admin-member-measurements", params.id],
    queryFn: () => getAdminMemberMeaşurementsApi(String(params.id)),
    enabled: entityRole === "MEMBER",
  });
  const trainerSkillsQuery = useQuery({
    queryKey: ["admin-trainer-skills", params.id],
    queryFn: () => getAdminTrainerSkillsApi(String(params.id)),
    enabled: entityRole === "TRAINER",
  });
  const trainerEarningsQuery = useQuery({
    queryKey: ["admin-trainer-earnings", params.id],
    queryFn: () => getAdminTrainerEarningsApi(String(params.id)),
    enabled: entityRole === "TRAINER",
  });
  const trainerBookingsQuery = useQuery({
    queryKey: ["admin-trainer-bookings", params.id],
    queryFn: () => getAdminBookingsApi({ trainer_id: String(params.id) }),
    enabled: entityRole === "TRAINER",
  });
  const trainerAssignmentsQuery = useQuery({
    queryKey: ["admin-trainer-package-assignments", params.id],
    queryFn: () => getAdminPackageAssignmentsApi({ trainer_id: String(params.id), is_active: true }),
    enabled: entityRole === "TRAINER",
  });

  const retention: RetentionItem = useMemo(() => retentionQuery.data || {}, [retentionQuery.data]);
  const attendance: AttendanceItem[] = Array.isArray(attendanceQuery.data) ? attendanceQuery.data : [];
  const measurements: MeasurementItem[] = Array.isArray(measurementsQuery.data) ? measurementsQuery.data : [];
  const trainerSkills = Array.isArray(trainerSkillsQuery.data) ? trainerSkillsQuery.data : [];
  const trainerBookings: TrainerBookingInsight[] = useMemo(
    () => (Array.isArray(trainerBookingsQuery.data) ? trainerBookingsQuery.data : []),
    [trainerBookingsQuery.data]
  );
  const trainerEarnings: AdminTrainerEarnings | null = trainerEarningsQuery.data || null;
  const trainerAssignments = useMemo(
    () => (Array.isArray(trainerAssignmentsQuery.data) ? trainerAssignmentsQuery.data : []),
    [trainerAssignmentsQuery.data]
  );

  const latestAttendance = attendance[0]?.starts_at || attendance[0]?.date || person?.last_attended_at || person?.updated_at;
  const latestMeasurement = measurements[0]?.measured_at || measurements[0]?.date;
  const retentionReasons = useMemo(() => getRetentionReasons(retention), [retention]);

  const riskReasons = useMemo(() => {
    const reasons: string[] = [];
    const attendanceDays = daysSince(latestAttendance);
    const measurementDays = daysSince(latestMeasurement);

    if (typeof attendanceDays === "number" && attendanceDays >= 10) reasons.push(`${attendanceDays} gündür katılım yok.`);
    if (attendance.length === 0) reasons.push("Henüz kayıtlı katılım görünmüyor.");
    if (typeof measurementDays === "number" && measurementDays >= 30) reasons.push(`${measurementDays} gündür ölçüm güncellenmedi.`);
    if (measurements.length === 0) reasons.push("Ölçüm takibi henüz başlatılmadı.");
    reasons.push(...retentionReasons);

    return Array.from(new Set(reasons));
  }, [attendance.length, latestAttendance, latestMeasurement, measurements.length, retentionReasons]);

  const trainerSummary = useMemo(() => buildTrainerSummary(trainerBookings), [trainerBookings]);
  const trainerLessonChips = useMemo(() => buildTrainerLessonChips(trainerAssignments), [trainerAssignments]);

  const personName = `${person?.first_name || ""} ${person?.last_name || ""}`.trim() || person?.email || `${roleLabel(entityRole)} detayı`;

  const isRefreshing =
    detailQuery.isRefetching ||
    retentionQuery.isRefetching ||
    attendanceQuery.isRefetching ||
    measurementsQuery.isRefetching ||
    trainerSkillsQuery.isRefetching ||
    trainerEarningsQuery.isRefetching ||
    trainerBookingsQuery.isRefetching ||
    trainerAssignmentsQuery.isRefetching;

  async function handleRefresh() {
    await Promise.all([
      detailQuery.refetch(),
      entityRole === "MEMBER" ? retentionQuery.refetch() : Promise.resolve(),
      entityRole === "MEMBER" ? attendanceQuery.refetch() : Promise.resolve(),
      entityRole === "MEMBER" ? measurementsQuery.refetch() : Promise.resolve(),
      entityRole === "TRAINER" ? trainerSkillsQuery.refetch() : Promise.resolve(),
      entityRole === "TRAINER" ? trainerEarningsQuery.refetch() : Promise.resolve(),
      entityRole === "TRAINER" ? trainerBookingsQuery.refetch() : Promise.resolve(),
      entityRole === "TRAINER" ? trainerAssignmentsQuery.refetch() : Promise.resolve(),
    ]);
  }

  const latestMeasurementItem = measurements[0] || null;
  const onboardingSummary = useMemo(
    () =>
      person?.onboarding_profile
        ? summarizeSignupOnboarding(entityRole, {
            primaryGoal: person.onboarding_profile.primary_goal || "",
            rhythm: person.onboarding_profile.rhythm || "",
            supportStyle: person.onboarding_profile.support_style || "",
          })
        : null,
    [entityRole, person?.onboarding_profile]
  );

  return (
    <AppShell
      title={personName}
      subtitle={entityRole === "TRAINER" ? "Kazanç, verilen dersler ve yetkinlikler tek ekranda doğrulanır." : "Paketler, katılım, ölçüm ve risk sinyalleri tek yerde."}
      icon={entityRole === "TRAINER" ? "trainer" : "members"}
      showBackButton
      onBack={backTo ? () => router.replace(backTo as never) : undefined}
      refreshing={isRefreshing}
      onRefresh={() => void handleRefresh()}
    >
      {!person ? (
        <SurfaceCard>
          <EmptyState title="Profil yükleniyor" description="Detay bilgileri hazırlanıyor." icon={entityRole === "TRAINER" ? "trainer" : "members"} />
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard tone="primary">
            <View style={styles.heroHeader}>
              <View style={styles.heroIdentity}>
                <Text style={styles.section}>{roleLabel(entityRole)} profili</Text>
                <Text style={styles.title}>{person.email || person.phone || "-"}</Text>
                <Text style={styles.copy}>Kayıt tarihi: {formatDate(person.created_at)}</Text>
              </View>
              <StatusBadge label={person.is_active ? "Aktif" : "Pasif"} tone={person.is_active ? "success" : "warning"} />
            </View>
            {entityRole === "TRAINER" ? (
              <Text style={styles.copy} testID="admin-trainer-hero-summary">
                Bugünkü özet: {formatCurrency(trainerEarnings?.daily_income)} kazanç, {trainerSummary.completed} tamamlanan ders.
              </Text>
            ) : (
              <>
                <Text style={styles.copy}>Risk skoru: {retention.score ?? retention.level ?? "Belirsiz"}</Text>
                <Text style={styles.copy}>Son temas: {formatDateTime(person.last_attended_at || person.updated_at)}</Text>
                <Text style={styles.copy}>Sebep: {riskReasons[0] || "Belirtilmedi"}</Text>
              </>
            )}
          </SurfaceCard>

          <View style={styles.metricsRow}>
            {entityRole === "TRAINER" ? (
              <>
                <MetricCard label="Tamamlanan ders" value={trainerSummary.completed} hint="Geçmiş rezervasyon" icon="calendar" />
                <MetricCard label="Atanan ders" value={trainerLessonChips.length} hint="Paket-trainer tanımı" icon="spark" />
                <MetricCard label="Aylık kazanç" value={formatCurrency(trainerEarnings?.monthly_income)} hint="Komisyon bazlı özet" icon="money" />
              </>
            ) : (
              <>
                <MetricCard label="Aktif paket" value={person.active_package_count || person.active_packages?.length || 0} hint="Yenileme adayı olabilir" icon="package" />
                <MetricCard label="Katılım" value={attendance.length} hint="Kayıtlı ders adedi" icon="calendar" />
              </>
            )}
          </View>

          {onboardingSummary ? <OnboardingSummaryCard summary={onboardingSummary} compact /> : null}

          {entityRole === "TRAINER" ? (
            <SurfaceCard testID="admin-trainer-competency-summary">
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>Verdiği dersler</Text>
                <StatusBadge label={`${trainerLessonChips.length} ders`} tone="info" />
              </View>
              {trainerAssignmentsQuery.isLoading ? (
                <Text style={styles.copy}>Trainer ders atamaları hazırlanıyor...</Text>
              ) : trainerLessonChips.length > 0 ? (
                <View style={styles.inlineMetaRow} testID="admin-trainer-assigned-lessons">
                  {trainerLessonChips.map((lesson) => (
                    <StatusBadge key={lesson} label={lesson} tone="info" />
                  ))}
                </View>
              ) : (
                <Text style={styles.copy}>Bu trainera atanmış aktif ders görünmüyor. Admin paket tanımını trainera bağladığında çocuk yogası, PT, grup dersi veya ilgili paket adı burada mavi kutucuklarla görünür.</Text>
              )}
            </SurfaceCard>
          ) : null}

          <SegmentedSwitch
            testID="admin-person-detail-tabs"
            value={tab}
            options={
              entityRole === "TRAINER"
                ? [
                    { label: "Genel", value: "GENERAL" },
                    { label: "Dersler", value: "SESSIONS" },
                    { label: "Kazanç", value: "EARNINGS" },
                    { label: "Yetkinlik", value: "SKILLS" },
                  ]
                : [
                    { label: "Genel", value: "GENERAL" },
                    { label: "Katılım", value: "ATTENDANCE" },
                    { label: "Ölçüm", value: "MEASUREMENTS" },
                    { label: "Risk", value: "RISK" },
                  ]
            }
            onChange={setTab}
          />

          {tab === "GENERAL" ? (
            <SurfaceCard>
              <Text style={styles.section}>Genel bilgi</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <AppIcon name="phone" size="sm" tone="neutral" />
                  <Text style={styles.copy}>Telefon: {person.phone || "-"}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <AppIcon name="email" size="sm" tone="neutral" />
                  <Text style={styles.copy}>E-posta: {person.email || "-"}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <AppIcon name="calendar" size="sm" tone="neutral" />
                  <Text style={styles.copy}>Kayıt: {formatDateTime(person.created_at)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <AppIcon name={entityRole === "TRAINER" ? "trainer" : "package"} size="sm" tone="neutral" />
                  <Text style={styles.copy}>
                    {entityRole === "TRAINER"
                      ? `Tanımlı yetkinlik: ${trainerSkills.length || 0}`
                      : `Aktif paket: ${person.active_package_count || person.active_packages?.length || 0}`}
                  </Text>
                </View>
              </View>
              {entityRole === "TRAINER" ? (
                <Text style={styles.hint}>Bu profil, eğitmenin yetkinliklerini ve kazanç akışını tek bakışta doğrulamak için düzenlendi.</Text>
              ) : null}
            </SurfaceCard>
          ) : null}

          {entityRole === "MEMBER" && tab === "ATTENDANCE" ? (
            <SurfaceCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>Katılım geçmişi</Text>
                <StatusBadge label={`${attendance.length} kayıt`} tone="info" />
              </View>
              {attendance.length === 0 ? (
                <EmptyState title="Katılım kaydı yok" description="İlk ders kaydı oluştuğunda burada listelenecek." icon="calendar" />
              ) : (
                <ScrollPanel maxHeight={420}>
                  {attendance.map((item, index: number) => (
                    <View key={item.id || index} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyTitleWrap}>
                          <Text style={styles.historyTitle}>{item.session_title || item.lesson_category_label || "Ders"}</Text>
                          <Text style={styles.copy}>{formatDateTime(item.starts_at || item.date || item.created_at)}</Text>
                        </View>
                        <StatusBadge
                          label={bookingStatusLabel(item.status) || "Planlandı"}
                          tone={String(item.status || "").toUpperCase() === "COMPLETED" ? "success" : "neutral"}
                        />
                      </View>
                      <View style={styles.inlineMetaRow}>
                        <View style={styles.metaPill}>
                          <AppIcon name="trainer" size="sm" tone="neutral" />
                          <Text style={styles.metaText}>{item.trainer_full_name || "Eğitmen belirtilmedi"}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <AppIcon name="package" size="sm" tone="neutral" />
                          <Text style={styles.metaText}>{item.package_name || item.package_title || "Paket belirtilmedi"}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollPanel>
              )}
              <Text style={styles.hint}>Katılım ritmi düşerse kampanya, yenileme veya eğitmen yönlendirmesi planlanmalı.</Text>
            </SurfaceCard>
          ) : null}

          {entityRole === "MEMBER" && tab === "MEASUREMENTS" ? (
            <SurfaceCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>Ölçüm geçmişi</Text>
                <StatusBadge label={`${measurements.length} kayıt`} tone="info" />
              </View>
              {latestMeasurementItem ? (
                <View style={styles.measurementGrid}>
                  <View style={[styles.measurementTile, styles.measurementTileNeutral]}>
                    <AppIcon name="weight" size="sm" tone="neutral" />
                    <Text style={styles.measurementLabel}>Kilo</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurementItem.weight_kg, "kg")}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileWarning]}>
                    <AppIcon name="droplets" size="sm" tone="warning" />
                    <Text style={styles.measurementLabel}>Yağ</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurementItem.fat_percent, "%", true)}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileInfo]}>
                    <AppIcon name="dumbbell" size="sm" tone="primary" />
                    <Text style={styles.measurementLabel}>Kas</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurementItem.muscle_kg ?? latestMeasurementItem.muscle_percent, "kg")}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileSuccess]}>
                    <AppIcon name="ruler" size="sm" tone="success" />
                    <Text style={styles.measurementLabel}>Boy</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurementItem.height_cm, "cm")}</Text>
                  </View>
                </View>
              ) : null}
              {measurements.length === 0 ? (
                <EmptyState title="Ölçüm kaydı yok" description="İlk ölçüm eklendiğinde burada özet ve geçmiş oluşacak." icon="measurements" />
              ) : (
                <ScrollPanel maxHeight={420}>
                  {measurements.map((item, index: number) => (
                    <View key={item.id || index} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyTitleWrap}>
                          <Text style={styles.historyTitle}>{formatDateTime(item.measured_at || item.date)}</Text>
                          <Text style={styles.copy}>Son kayıtla kıyas ve trend takibi için detay kartı</Text>
                        </View>
                        <StatusBadge label="Ölçüm" tone="info" />
                      </View>
                      <View style={styles.measurementRow}>
                        <View style={styles.measurementMeta}>
                          <Text style={styles.measurementMetaLabel}>Kilo</Text>
                          <Text style={styles.measurementMetaValue}>{formatMetricValue(item.weight_kg, "kg")}</Text>
                        </View>
                        <View style={styles.measurementMeta}>
                          <Text style={styles.measurementMetaLabel}>Yağ</Text>
                          <Text style={styles.measurementMetaValue}>{formatMetricValue(item.fat_percent, "%", true)}</Text>
                        </View>
                        <View style={styles.measurementMeta}>
                          <Text style={styles.measurementMetaLabel}>Kas</Text>
                          <Text style={styles.measurementMetaValue}>{formatMetricValue(item.muscle_kg ?? item.muscle_percent, "kg")}</Text>
                        </View>
                        <View style={styles.measurementMeta}>
                          <Text style={styles.measurementMetaLabel}>Boy</Text>
                          <Text style={styles.measurementMetaValue}>{formatMetricValue(item.height_cm, "cm")}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollPanel>
              )}
              <Text style={styles.hint}>Ölçümler güncel tutulursa hedef ve bağlılık takibi kolaylaşır.</Text>
            </SurfaceCard>
          ) : null}

          {entityRole === "MEMBER" && tab === "RISK" ? (
            <SurfaceCard tone="warning">
              <Text style={styles.section}>Risk analizi</Text>
              <Text style={styles.copy}>10+ gündür katılım yoksa, paket bitmeye yaklaştıysa veya ölçüm 30 gündür güncellenmediyse üye risk havuzuna girer.</Text>
              <ScrollPanel maxHeight={220}>
                {riskReasons.length ? (
                  riskReasons.map((reason) => (
                    <View key={reason} style={styles.riskRow}>
                      <AppIcon name="risk" size="sm" tone="warning" />
                      <Text style={styles.copy}>{reason}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.copy}>Şu an belirgin risk sinyali görünmüyor.</Text>
                )}
              </ScrollPanel>
            </SurfaceCard>
          ) : null}

          {entityRole === "TRAINER" && tab === "SESSIONS" ? (
            <SurfaceCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>Verilen dersler</Text>
                <StatusBadge label={`${trainerLessonChips.length} tanımlı`} tone="info" />
              </View>
              {trainerLessonChips.length > 0 ? (
                <View style={styles.inlineMetaRow}>
                  {trainerLessonChips.map((lesson) => (
                    <StatusBadge key={lesson} label={lesson} tone="info" />
                  ))}
                </View>
              ) : null}
              <StatusBadge label={`${trainerSummary.completed} tamamlanan ders`} tone="success" />
              {trainerSummary.recentLessons.length === 0 ? (
                <EmptyState title="Tamamlanan ders görünmüyor" description="İlk rezervasyonlar oluştukça burada ders geçmişi akacak." icon="calendar" />
              ) : (
                <ScrollPanel maxHeight={420}>
                  {trainerSummary.recentLessons.map((item) => (
                    <View key={item.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyTitleWrap}>
                          <Text style={styles.historyTitle}>{item.lesson_category_label || item.session_title || "Ders"}</Text>
                          <Text style={styles.copy}>{formatDateTime(item.starts_at)}</Text>
                        </View>
                        <StatusBadge label="Tamamlandı" tone="success" />
                      </View>
                      <View style={styles.inlineMetaRow}>
                        <View style={styles.metaPill}>
                          <AppIcon name="member" size="sm" tone="neutral" />
                          <Text style={styles.metaText}>{item.member_full_name || "Üye belirtilmedi"}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <AppIcon name="package" size="sm" tone="neutral" />
                          <Text style={styles.metaText}>{item.package_title || "Paket belirtilmedi"}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollPanel>
              )}
              <Text style={styles.hint}>Mavi kutucuklar adminin paketi trainera bağladığı aktif ders tanımlarından gelir; geçmiş listesi ise tamamlanan rezervasyonları gösterir.</Text>
            </SurfaceCard>
          ) : null}

          {entityRole === "TRAINER" && tab === "EARNINGS" ? (
            <SurfaceCard>
              <Text style={styles.section}>Kazanç özeti</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.earningTile} testID="admin-trainer-earning-daily">
                  <Text style={styles.measurementLabel}>Günlük</Text>
                  <Text style={styles.earningValue}>{formatCurrency(trainerEarnings?.daily_income)}</Text>
                </View>
                <View style={styles.earningTile} testID="admin-trainer-earning-weekly">
                  <Text style={styles.measurementLabel}>Haftalık</Text>
                  <Text style={styles.earningValue}>{formatCurrency(trainerEarnings?.weekly_income)}</Text>
                </View>
                <View style={styles.earningTile} testID="admin-trainer-earning-monthly">
                  <Text style={styles.measurementLabel}>Aylık</Text>
                  <Text style={styles.earningValue}>{formatCurrency(trainerEarnings?.monthly_income)}</Text>
                </View>
                <View style={styles.earningTile} testID="admin-trainer-earning-yearly">
                  <Text style={styles.measurementLabel}>Yıllık</Text>
                  <Text style={styles.earningValue}>{formatCurrency(trainerEarnings?.yearly_income)}</Text>
                </View>
              </View>
              <Text style={styles.hint}>Bu alan check-in sonrası otomatik yenilenir; günlük, haftalık, aylık ve yıllık toplamlar aynı matematik tabanından beslenir.</Text>
            </SurfaceCard>
          ) : null}

          {entityRole === "TRAINER" && tab === "SKILLS" ? (
            <SurfaceCard>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>Verebildiği dersler</Text>
                <StatusBadge label={`${trainerSkills.length} yetkinlik`} tone="info" />
              </View>
              {trainerSkills.length === 0 ? (
                <EmptyState title="Yetkinlik tanımlı değil" description="Eğitmenin verebildiği ders kategorileri burada görünür." icon="trainer" />
              ) : (
                <View style={styles.inlineMetaRow} testID="admin-trainer-skills-list">
                  {trainerSkills.map((skill) => (
                    <View key={skill} style={styles.skillPill}>
                      <AppIcon name="spark" size="sm" tone="primary" />
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              )}
            </SurfaceCard>
          ) : null}

          <SurfaceCard>
            <Text style={styles.section}>Aksiyonlar</Text>
            {entityRole === "TRAINER" ? (
              <>
                <ActionButton label="Salon takvimini aç" icon="calendar" onPress={() => router.push("/(admin)/calendar" as never)} />
                <ActionButton label="Üye listesine dön" icon="members" variant="ghost" onPress={() => router.push("/(admin)/members" as never)} />
              </>
            ) : (
              <>
                <ActionButton label="Kampanya gönder" icon="campaigns" onPress={() => router.push({ pathname: "/(admin)/campaigns", params: { backTo: `/(admin)/members/${params.id}` } } as never)} />
                <ActionButton label="Riskli üyeleri aç" icon="risk" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/risk-members", params: { backTo: `/(admin)/members/${params.id}` } } as never)} />
                <ActionButton label="Paket yenileme öner" icon="package" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/campaigns", params: { backTo: `/(admin)/members/${params.id}` } } as never)} />
              </>
            )}
          </SurfaceCard>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  heroIdentity: {
    flex: 1,
    gap: 4,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
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
  hint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  historyCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  historyTitleWrap: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  inlineMetaRow: {
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
  metaText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  measurementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  measurementTile: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
    borderWidth: 1,
  },
  measurementTileNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  measurementTileSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  measurementTileWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  measurementTileInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  measurementLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  measurementValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  measurementRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  measurementMeta: {
    flexBasis: "46%",
    flexGrow: 1,
    gap: 4,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.backgroundStrong,
  },
  measurementMetaLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  measurementMetaValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  skillPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  skillText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  earningTile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.xs + 2,
  },
  earningValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
});
