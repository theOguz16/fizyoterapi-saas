// Bu sayfa mobil uygulamada trainer akisindaki detay ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  getTrainerMemberAttendanceApi,
  getTrainerMemberDetailApi,
  getTrainerMemberMeasurementsApi,
  getTrainerMemberNotesApi,
} from "@/lib/mobile-api";
import { summarizeSignupOnboarding } from "@/lib/signup-onboarding";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { OnboardingSummaryCard } from "@/theme/components/onboarding-summary-card";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { TrainerMemberMeasurementChart } from "@/theme/components/trainer-member-measurement-chart";
import { tokens } from "@/theme/tokens";

type TrainerMemberDetail = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  onboarding_profile?: {
    role?: "MEMBER" | "TRAINER" | "ADMIN";
    primary_goal?: string;
    rhythm?: string;
    support_style?: string;
  } | null;
  qr_code?: string | null;
  stats?: {
    booking_count?: number;
    checkin_count?: number;
    latest_measured_at?: string | null;
  };
  package_summary?: Array<{
    user_package_id: string;
    package_id: string;
    package_title?: string | null;
    package_type?: string | null;
    package_total_credits?: number | null;
    package_duration_days?: number | null;
    package_price?: number | null;
    package_rules?: Record<string, unknown> | null;
    remaining_credits: number;
    is_active: boolean;
    starts_at?: string | null;
    expires_at?: string | null;
    is_expired?: boolean;
    trainer_summary?: string | null;
  }>;
  campaign_rewards?: Array<{
    id: string;
    credits_granted: number;
    rule_name: string;
    granted_at: string;
  }>;
};

type AttendanceRow = {
  id: string;
  created_at: string;
  result?: string | null;
  credits_deducted?: number | null;
  session_title?: string | null;
  lesson_category?: string | null;
};

type MeasurementRow = {
  id: string;
  measured_at: string;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  fat_percent: string | number | null;
  muscle_kg: string | number | null;
};

type NoteRow = {
  id: string;
  title?: string | null;
  note?: string | null;
  body?: string | null;
  category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NotesPayload = {
  note?: string | null;
  body?: string | null;
  category?: string | null;
  updated_at?: string | null;
  items?: NoteRow[];
};

function formatDate(value?: string | null) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belirtilmedi";
  return date.toLocaleDateString("tr-TR");
}

function formatChartDate(value?: string | null) {
  if (!value) return "--.--.--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--.--.--";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belirtilmedi";
  return date.toLocaleString("tr-TR");
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMetricValue(value: string | number | null | undefined, unit?: string, prefix = false) {
  const numeric = toNumber(value);
  if (numeric === null) return "-";
  const text = numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
  if (!unit) return text;
  return prefix ? `${unit}${text}` : `${text} ${unit}`;
}

function noteCategoryLabel(value?: string | null) {
  if (value === "GOAL") return "Hedef";
  if (value === "RISK") return "Risk";
  if (value === "FOLLOW_UP") return "Takip";
  return "Genel";
}

function noteCategoryTone(value?: string | null): "success" | "warning" | "danger" | "info" {
  if (value === "GOAL") return "success";
  if (value === "RISK") return "danger";
  if (value === "FOLLOW_UP") return "warning";
  return "info";
}

function noteCategoryIcon(value?: string | null): AppIconName {
  if (value === "GOAL") return "target";
  if (value === "RISK") return "risk";
  if (value === "FOLLOW_UP") return "clock";
  return "notes";
}

function filterMeasurementsByRange(rows: MeasurementRow[], range: "30" | "90" | "ALL") {
  if (range === "ALL") return rows;
  const days = Number(range);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    const time = new Date(row.measured_at).getTime();
    return Number.isFinite(time) && time >= since;
  });
}

function attendanceResultLabel(value?: string | null) {
  if (value === "CHECKED_IN") return "Katıldı";
  if (value === "MISSED") return "Gelmedi";
  if (value === "CANCELLED") return "İptal";
  if (value === "CREDIT_DEDUCTED") return "Hak düşüldü";
  if (value === "NO_SHOW") return "Gelmedi";
  if (value === "RESCHEDULED") return "Ertelendi";
  return value ? value.replaceAll("_", " ").toLocaleLowerCase("tr-TR").replace(/^\w/, (char) => char.toLocaleUpperCase("tr-TR")) : "Kayıt";
}

function lessonCategoryLabel(value?: string | null) {
  if (!value) return "Belirtilmedi";
  if (value === "PERSONAL_TRAINING") return "Birebir antrenman";
  if (value === "GROUP_CLASS") return "Grup dersi";
  if (value === "REFORMER") return "Reformer";
  if (value === "CARDIO") return "Kardiyo";
  if (value === "STRENGTH") return "Kuvvet";
  if (value === "PILATES") return "Pilates";
  if (value === "YOGA") return "Yoga";
  return value.replaceAll("_", " ").toLocaleLowerCase("tr-TR").replace(/^\w/, (char) => char.toLocaleUpperCase("tr-TR"));
}

function extractLessonLabel(pkg: NonNullable<TrainerMemberDetail["package_summary"]>[number]) {
  const rules = pkg.package_rules || {};
  const serviceName = typeof rules.service_name === "string" ? rules.service_name : "";
  const lessonCategory = typeof rules.lesson_category === "string" ? rules.lesson_category : "";
  const serviceKey = typeof rules.service_key === "string" ? rules.service_key : "";
  return serviceName || lessonCategory || serviceKey || pkg.package_type || "Belirtilmedi";
}

export default function TrainerClientDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; backTo?: string | string[] }>();
  const [tab, setTab] = useState("SUMMARY");
  const [chartRange, setChartRange] = useState<"30" | "90" | "ALL">("90");

  const detailQuery = useQuery<TrainerMemberDetail>({
    queryKey: ["trainer-member-detail", params.id],
    queryFn: () => getTrainerMemberDetailApi(String(params.id)),
  });
  const attendanceQuery = useQuery<AttendanceRow[]>({
    queryKey: ["trainer-member-attendance", params.id],
    queryFn: () => getTrainerMemberAttendanceApi(String(params.id)),
  });
  const measurementsQuery = useQuery<MeasurementRow[]>({
    queryKey: ["trainer-member-measurements", params.id],
    queryFn: () => getTrainerMemberMeasurementsApi(String(params.id)),
  });
  const notesQuery = useQuery<NotesPayload>({
    queryKey: ["trainer-member-notes", params.id],
    queryFn: () => getTrainerMemberNotesApi(String(params.id)),
  });

  const detail = detailQuery.data;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const attendance = useMemo(
    () => (Array.isArray(attendanceQuery.data) ? attendanceQuery.data : []),
    [attendanceQuery.data]
  );
  const measurements = useMemo(
    () => (Array.isArray(measurementsQuery.data) ? measurementsQuery.data : []),
    [measurementsQuery.data]
  );
  const notesPayload = notesQuery.data || {};
  const noteItems = Array.isArray(notesPayload.items) ? notesPayload.items : [];

  const activePackageCount = (detail?.package_summary || []).filter((pkg) => pkg.is_active && !pkg.is_expired).length;
  const totalRemainingCredits = (detail?.package_summary || []).reduce((sum, pkg) => sum + Number(pkg.remaining_credits || 0), 0);
  const latestAttendance = attendance[0] || null;
  const latestMeasurement = measurements[0] || null;
  const refreshing = detailQuery.isRefetching || attendanceQuery.isRefetching || measurementsQuery.isRefetching || notesQuery.isRefetching;

  const filteredMeasurementRows = useMemo(() => filterMeasurementsByRange(measurements, chartRange), [measurements, chartRange]);
  const measurementTrend = useMemo(
    () =>
      [...filteredMeasurementRows]
        .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
        .map((row) => ({
          label: formatChartDate(row.measured_at),
          height_cm: toNumber(row.height_cm),
          weight_kg: toNumber(row.weight_kg),
          fat_percent: toNumber(row.fat_percent),
          muscle_kg: toNumber(row.muscle_kg),
        })),
    [filteredMeasurementRows]
  );
  const onboardingSummary = useMemo(() => {
    if (!detail?.onboarding_profile) return null;
    if (!detail.onboarding_profile.primary_goal || !detail.onboarding_profile.rhythm || !detail.onboarding_profile.support_style) return null;
    return summarizeSignupOnboarding("MEMBER", {
      primaryGoal: detail.onboarding_profile.primary_goal,
      rhythm: detail.onboarding_profile.rhythm,
      supportStyle: detail.onboarding_profile.support_style,
    });
  }, [detail?.onboarding_profile]);
  const coachingInsight = useMemo(() => {
    if (!measurements.length && !attendance.length) return "Ölçüm ve katılım verisi oluştuğunda gelişim yorumu burada görünür.";
    const recentAttendance = attendance.filter((row) => Date.now() - new Date(row.created_at).getTime() <= 28 * 86400000).length;
    if (measurements.length >= 2 && recentAttendance >= 4) return "Düzenli katılım ile ölçüm geçmişi birlikte ilerliyor. Mevcut programın etkisini dönem karşılaştırmasıyla takip edebilirsin.";
    if (recentAttendance < 4) return "Son 28 günlük katılım düşük görünüyor. Ölçüm hedefinden önce ders devamlılığını güçlendirmek daha anlamlı olabilir.";
    return "Katılım düzenli; ölçüm karşılaştırmasını güçlendirmek için yeni bir ölçüm kaydı planlanabilir.";
  }, [attendance, measurements]);

  async function handleRefresh() {
    await Promise.all([
      detailQuery.refetch(),
      attendanceQuery.refetch(),
      measurementsQuery.refetch(),
      notesQuery.refetch(),
    ]);
  }

  return (
    <AppShell
      title={detail?.full_name || "Danışan detayı"}
      subtitle="Aktif paket, katılım, notlar ve ölçümleri mobilde tek ekranda takip et."
      icon="clients"
      refreshing={refreshing}
      onRefresh={() => {
        handleRefresh().catch(() => null);
      }}
    >
      <SurfaceCard tone="primary" padding="hero">
        <View style={styles.heroHeader}>
          <View style={styles.heroIdentity}>
            <Text style={styles.title}>{detail?.full_name || "-"}</Text>
            <Text style={styles.copy}>{detail?.phone || detail?.email || "İletişim bilgisi henüz eklenmemiş"}</Text>
          </View>
          <StatusBadge label={detail?.is_active ? "Aktif" : "Pasif"} tone={detail?.is_active ? "success" : "neutral"} />
        </View>
        <View style={styles.row}>
          <StatusBadge label={`Aktif paket ${activePackageCount}`} tone="success" />
          <StatusBadge label={`Kalan hak ${totalRemainingCredits}`} tone="info" />
          <StatusBadge label={`Kampanya ${detail?.campaign_rewards?.length || 0}`} tone="premium" />
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <AppIcon name="email" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>E-posta</Text>
              <Text style={styles.summaryValue}>{detail?.email || "E-posta eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="phone" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Telefon</Text>
              <Text style={styles.summaryValue}>{detail?.phone || "Telefon eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="qr" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>QR</Text>
              <Text style={styles.summaryValue}>{detail?.qr_code || "Tanımsız"}</Text>
            </View>
          </View>    
          <View style={styles.summaryItem}>
            <AppIcon name="calendar" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Son katılım</Text>
              <Text style={styles.summaryValue}>{formatDateTime(latestAttendance?.created_at)}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="measurements" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Son ölçüm</Text>
              <Text style={styles.summaryValue}>{formatDateTime(detail?.stats?.latest_measured_at || latestMeasurement?.measured_at)}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard label="Aktif paket" value={activePackageCount} hint="Kullanılabilir paketler" icon="package" />
        <MetricCard label="Toplam kalan hak" value={totalRemainingCredits} hint="Tüm paketlerden kalan" icon="ticket" />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard label="Son katılım" value={latestAttendance ? formatDate(latestAttendance.created_at) : "-"} hint="En güncel check-in" icon="calendar" />
        <MetricCard label="Kampanya ödülü" value={detail?.campaign_rewards?.length || 0} hint="Referans ve sadakat" icon="gift" />
      </View>

      {onboardingSummary ? <OnboardingSummaryCard summary={onboardingSummary} compact /> : null}

      <SurfaceCard tone="primary">
        <Text style={styles.section}>Katılım ve ölçüm ilişkisi</Text>
        <Text style={styles.copy}>{coachingInsight}</Text>
      </SurfaceCard>

      <SegmentedSwitch
        value={tab}
        options={[
          { label: "Özet", value: "SUMMARY" },
          { label: "Geçmiş", value: "HISTORY" },
          { label: "Grafik", value: "PROGRESS" },
        ]}
        onChange={setTab}
      />

      {tab === "SUMMARY" ? (
        <>
          <SurfaceCard>
            <Text style={styles.section}>Son ölçüm bilgileri</Text>
            <View style={styles.measurementGrid}>
              <View style={[styles.measurementTile, styles.measurementTileNeutral]}>
                <AppIcon name="ruler" size="sm" tone="neutral" />
                <Text style={styles.measurementLabel}>Boy</Text>
                <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurement?.height_cm, "cm")}</Text>
              </View>
              <View style={[styles.measurementTile, styles.measurementTileSuccess]}>
                <AppIcon name="weight" size="sm" tone="success" />
                <Text style={styles.measurementLabel}>Kilo</Text>
                <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurement?.weight_kg, "kg")}</Text>
              </View>
              <View style={[styles.measurementTile, styles.measurementTileWarning]}>
                <AppIcon name="droplets" size="sm" tone="warning" />
                <Text style={styles.measurementLabel}>Yağ</Text>
                <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurement?.fat_percent, "%", true)}</Text>
              </View>
              <View style={[styles.measurementTile, styles.measurementTileInfo]}>
                <AppIcon name="dumbbell" size="sm" tone="primary" />
                <Text style={styles.measurementLabel}>Kas</Text>
                <Text style={styles.measurementValue}>{formatMetricValue(latestMeasurement?.muscle_kg, "kg")}</Text>
              </View>
            </View>
            <Text style={styles.hint}>Son kayıt: {formatDateTime(latestMeasurement?.measured_at || detail?.stats?.latest_measured_at)}</Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.section}>Paket geçmişi</Text>
            {(detail?.package_summary || []).length === 0 ? (
              <Text style={styles.copy}>Bu danışana ait paket geçmişi henüz görünmüyor. İlk paket tanımlandığında burada listelenecek.</Text>
            ) : (
              <ScrollPanel>
                {(detail?.package_summary || []).map((pkg) => (
                  <View key={pkg.user_package_id} style={styles.listCard}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.grow}>
                        <Text style={styles.cardTitle}>{pkg.package_title || pkg.package_id}</Text>
                        <Text style={styles.copy}>{extractLessonLabel(pkg)}</Text>
                      </View>
                      <StatusBadge label={pkg.is_active && !pkg.is_expired ? "Aktif" : "Pasif"} tone={pkg.is_active && !pkg.is_expired ? "success" : "neutral"} />
                    </View>
                    <View style={styles.row}>
                      <StatusBadge label={`Kalan ${pkg.remaining_credits}`} tone="info" />
                      <StatusBadge label={`Toplam ${pkg.package_total_credits ?? "-"}`} tone="warning" />
                    </View>
                    <View style={styles.packageMetaRow}>
                      <View style={styles.packageMetaItem}>
                        <AppIcon name="wallet" size="sm" tone="success" />
                        <View style={styles.grow}>
                          <Text style={styles.summaryLabel}>Fiyat</Text>
                          <Text style={styles.summaryValue}>{pkg.package_price ? `₺${Number(pkg.package_price).toLocaleString("tr-TR")}` : "Fiyat girilmemiş"}</Text>
                        </View>
                      </View>
                      <View style={styles.packageMetaItem}>
                        <AppIcon name="clock" size="sm" tone="warning" />
                        <View style={styles.grow}>
                          <Text style={styles.summaryLabel}>Süre</Text>
                          <Text style={styles.summaryValue}>{pkg.package_duration_days ? `${pkg.package_duration_days} gün` : "Süresiz"}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.copy}>Başlangıç: {formatDate(pkg.starts_at)} • Bitiş: {formatDate(pkg.expires_at)}</Text>
                    <Text style={styles.copy}>Eğitmen: {pkg.trainer_summary || "Bu paket için eğitmen ataması henüz görünmüyor"}</Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.section}>Kampanya ödülleri</Text>
            {(detail?.campaign_rewards || []).length === 0 ? (
              <Text style={styles.copy}>Bu danışan için kampanya ya da referans ödülü kaydı henüz oluşmamış.</Text>
            ) : (
              <ScrollPanel maxHeight={240}>
                {(detail?.campaign_rewards || []).map((reward) => (
                  <View key={reward.id} style={styles.inlineBetween}>
                    <View style={styles.grow}>
                      <Text style={styles.cardTitle}>{reward.rule_name}</Text>
                      <Text style={styles.copy}>{formatDateTime(reward.granted_at)}</Text>
                    </View>
                    <StatusBadge label={`+${reward.credits_granted}`} tone="premium" />
                  </View>
                ))}
              </ScrollPanel>
            )}
          </SurfaceCard>
        </>
      ) : null}

      {tab === "HISTORY" ? (
        <>
          <SurfaceCard>
            <Text style={styles.section}>Hangi derslere katıldı</Text>
            {attendance.length === 0 ? (
              <Text style={styles.copy}>Katılım geçmişi henüz oluşmamış. İlk check-in veya ders katılımı sonrasında burada listelenecek.</Text>
            ) : (
              <ScrollPanel>
                {attendance.map((item) => (
                  <View key={item.id} style={styles.listCard}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.grow}>
                        <Text style={styles.cardTitle}>{item.session_title || lessonCategoryLabel(item.lesson_category) || "Ders"}</Text>
                        <Text style={styles.copy}>{formatDateTime(item.created_at)}</Text>
                      </View>
                      <StatusBadge label={attendanceResultLabel(item.result)} tone={item.result === "MISSED" ? "danger" : "success"} />
                    </View>
                    <Text style={styles.copy}>Kategori: {lessonCategoryLabel(item.lesson_category)}</Text>
                    <Text style={styles.copy}>Düşülen hak: {item.credits_deducted ?? 0}</Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.section}>Koç Notları</Text>
            {noteItems.length === 0 ? (
              <Text style={styles.copy}>Bu danışan için henüz koç notu eklenmemiş. İlk not kaydı sonrasında burada görünecek.</Text>
            ) : (
              <ScrollPanel>
                {noteItems.map((item) => (
                  <View key={item.id} style={styles.listCard}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.noteTitleRow}>
                        <AppIcon name={noteCategoryIcon(item.category)} size="sm" tone={item.category === "RISK" ? "danger" : item.category === "GOAL" ? "success" : item.category === "FOLLOW_UP" ? "warning" : "neutral"} />
                        <Text style={styles.cardTitle}>{item.title || noteCategoryLabel(item.category)}</Text>
                      </View>
                      <StatusBadge label={noteCategoryLabel(item.category)} tone={noteCategoryTone(item.category)} />
                    </View>
                    <Text style={styles.copy}>{item.body || item.note || "-"}</Text>
                    <Text style={styles.hint}>Güncelleme: {formatDateTime(item.updated_at || item.created_at)}</Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.section}>Ölçüm Geçmişi</Text>
            {measurements.length === 0 ? (
              <Text style={styles.copy}>Ölçüm geçmişi henüz başlamamış. Boy, kilo, yağ ve kas verisi girildiğinde buradan akışa dahil olacak.</Text>
            ) : (
              <ScrollPanel>
                {measurements.map((item) => (
                  <View key={item.id} style={styles.listCard}>
                    <Text style={styles.cardTitle}>{formatDateTime(item.measured_at)}</Text>
                    <Text style={styles.copy}>
                      Boy {formatMetricValue(item.height_cm, "cm")} • Kilo {formatMetricValue(item.weight_kg, "kg")}
                    </Text>
                    <Text style={styles.copy}>
                      Yağ {formatMetricValue(item.fat_percent, "%", true)} • Kas {formatMetricValue(item.muscle_kg, "kg")}
                    </Text>
                  </View>
                ))}
              </ScrollPanel>
            )}
          </SurfaceCard>
        </>
      ) : null}

      {tab === "PROGRESS" ? (
        <>
          <SurfaceCard>
            <Text style={styles.section}>Boy, kilo, yağ ve kas takibi</Text>
            <Text style={styles.copy}>Danışanın ölçüm trendini grafikle takip et.</Text>
            <SegmentedSwitch
              value={chartRange}
              options={[
                { label: "30 gün", value: "30" },
                { label: "90 gün", value: "90" },
                { label: "Tümü", value: "ALL" },
              ]}
              onChange={(value) => setChartRange(value as "30" | "90" | "ALL")}
            />
            <TrainerMemberMeasurementChart points={measurementTrend} />
          </SurfaceCard>

          <SurfaceCard tone="success">
            <Text style={styles.section}>Takip özeti</Text>
            <Text style={styles.copy}>Seçili aralıktaki ölçüm kaydı: {filteredMeasurementRows.length}</Text>
            <Text style={styles.copy}>Toplam ölçüm kaydı: {measurements.length}</Text>
            <Text style={styles.copy}>Son ölçüm tarihi: {formatDateTime(latestMeasurement?.measured_at)}</Text>
            <Text style={styles.copy}>Son katılım tarihi: {formatDateTime(latestAttendance?.created_at)}</Text>
          </SurfaceCard>
        </>
      ) : null}

      <SurfaceCard>
        <ActionButton
          label="Koç Notları"
          icon="notes"
          onPress={() =>
            router.push({
              pathname: "/(trainer)/notes",
              params: { memberId: String(params.id), memberName: detail?.full_name || "", backTo: backTo || "/(trainer)/clients" },
            } as never)
          }
        />
        <ActionButton label="QR ile check-in" icon="qr" variant="ghost" onPress={() => router.push({ pathname: "/(trainer)/checkin", params: { backTo: `/(trainer)/members/${params.id}` } } as never)} />
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  heroIdentity: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryItem: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
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
  listCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
  },
  packageMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  packageMetaItem: {
    flexGrow: 1,
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    padding: tokens.spacing.sm + 2,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  noteTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  hint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});
