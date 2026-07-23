// Bu sayfa mobil uygulamada admin akisindaki detay ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { approveAdminMobileItemApi } from "@/lib/mobile-api";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { safeBack } from "@/lib/navigation";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

function getStatusTone(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized.includes("APPRO")) return "success" as const;
  if (normalized.includes("REJECT")) return "danger" as const;
  return "warning" as const;
}

function getJourneyCopy(type: string) {
  switch (String(type || "").toUpperCase()) {
    case "PAYMENT":
      return "Ödeme doğrulanırsa üyelik aktifleşir ve plan kaydı sonraki operasyon adımına geçer.";
    case "CHANGE_REQUEST":
      return "Takvim, eğitmen veya paket etkisi kontrol edilip ilgili kayıtlar birlikte güncellenmelidir.";
    default:
      return "Başvuru notu, beklenti ve operasyon uygunluğu birlikte değerlendirilmelidir.";
  }
}

function isActiveMembershipPackagePurchase(params: { type?: string; requestScope?: string }) {
  return String(params.type || "").toUpperCase() === "PAYMENT" && String(params.requestScope || "").toUpperCase() === "ACTIVE_MEMBERSHIP";
}

export default function AdminApprovalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    subtitle: string;
    status: string;
    type: string;
    amount: string;
    memberName: string;
    memberEmail: string;
    note: string;
    requestType: string;
    requestScope: string;
    activeMembershipId: string;
    submittedAt: string;
    lessonName: string;
    isGroupClass: string;
    recurrenceLabel: string;
    specialDate: string;
    requestedPrice: string;
    notificationScope: string;
    invitedMemberCount: string;
    joinedMemberCount: string;
    isDuo: string;
    duoPartnerName: string;
    duoPartnerContact: string;
    duoPaymentStatus: string;
    duoPaymentNote: string;
  }>();
 const approveMutation = useMutation({
  mutationFn: (decision: "APPROVE" | "REJECT") =>
    approveAdminMobileItemApi(String(params.id), decision),

  meta: {
  invalidates: [
    ["admin-approvals-v2"],
    ["admin-dashboard-v2"],
    ["admin-dashboard"],

    ["admin-bookings"],
    ["admin-bookings-calendar"],
    ["admin-settings-calendar"],

    ["member-home"],
    ["member-home-v2"],
    ["member-packages"],
    ["member-my-packages"],
    ["member-bookings"],
    ["member-bookings-calendar"],
    ["member-payment-requests"],
    ["member-change-requests"],

    ["trainer-bookings"],
    ["trainer-today"],
    ["trainer-today-calendar"],
  ],
},

  onSuccess: () => {
    safeBack(router, "/(admin)/approvals");
  },
});

  const memberLabel = String(params.memberName || "Üye");
  const memberEmail = String(params.memberEmail || "");
  const submittedAt = formatSubmittedAt(String(params.submittedAt || ""));
  const amountLabel = formatAmount(String(params.amount || ""));
  const detailNote = String(params.note || "").trim();
  const subtitle = String(params.subtitle || "").trim();
  const isGroupClass = String(params.isGroupClass || "") === "1";
  const isDuo = String(params.isDuo || "") === "1";
  const isMembershipAddOn = isActiveMembershipPackagePurchase({ type: params.type, requestScope: params.requestScope });

  return (
    <AppShell testID="admin-approval-detail-screen" title={String(params.title || "Onay detayı")} subtitle="Kararı vermeden önce kayıt özeti, operasyon etkisi ve üye notunu kontrol edin." icon="approvals" showBackButton>
      <SurfaceCard tone="primary">
        <StatusBadge label={String(params.status || "PENDING")} tone={getStatusTone(String(params.status || ""))} />
        {isMembershipAddOn ? <StatusBadge label="Mevcut üyeye ek paket" tone="warning" /> : null}
        {isDuo ? <StatusBadge label="Duo %50 ödeme" tone="info" /> : null}
        <Text style={styles.copy}>{subtitle || "Kayıt özeti burada görünür."}</Text>
      </SurfaceCard>
      <View style={styles.metricsRow}>
        <MetricCard label="Kayıt tipi" value={resolveTypeLabel(String(params.type || "APPLICATION"))} hint="Operasyon akışı" icon="approvals" />
        <MetricCard label="Tutar" value={amountLabel} hint="Paket veya ödeme tutarı" icon="wallet" />
      </View>
      <SurfaceCard>
        <Text style={styles.section}>Kayıt özeti</Text>
        <Text style={styles.copy}>{memberLabel}{memberEmail ? ` • ${memberEmail}` : ""}</Text>
        <Text style={styles.copy}>Talep zamanı: {submittedAt}</Text>
        <Text style={styles.copy}>{subtitle || "Kullanıcı kaydı operasyon kuyruğunda bekliyor."}</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.section}>Operasyon değerlendirmesi</Text>
        <Text style={styles.copy}>Talep tipi: {resolveRequestTypeLabel(String(params.requestType || params.type || ""))}</Text>
        <Text style={styles.copy}>Akış: {isMembershipAddOn ? "Mevcut üyelik üzerine ek paket satışı" : "Standart başvuru / ödeme akışı"}</Text>
        {isMembershipAddOn && String(params.activeMembershipId || "") ? (
          <Text style={styles.copy}>Aktif üyelik kaydı: {String(params.activeMembershipId)}</Text>
        ) : null}
        <Text style={styles.copy}>Tutar: {amountLabel}</Text>
        <Text style={styles.copy}>{isDuo ? "Onay sonrası ilk üyenin ödeme payı kayda alınır. Partner daveti ve kalan ödeme tamamlanmadan duo paket aktifleşmez." : getJourneyCopy(String(params.type || ""))}</Text>
      </SurfaceCard>
      {isDuo ? (
        <SurfaceCard>
          <Text style={styles.section}>Duo detayı</Text>
          <Text style={styles.copy}>Partner: {String(params.duoPartnerName || "Belirtilmedi")}</Text>
          <Text style={styles.copy}>İletişim: {String(params.duoPartnerContact || "İletişim bekleniyor")}</Text>
          <Text style={styles.copy}>Ödeme durumu: {String(params.duoPaymentStatus || "Partner ödemesi bekleniyor")}</Text>
          <Text style={styles.copy}>{String(params.duoPaymentNote || "Partner kendi payını tamamladığında ikili dersler aktif takvime alınır.")}</Text>
        </SurfaceCard>
      ) : null}
      {isGroupClass ? (
        <SurfaceCard>
          <Text style={styles.section}>Grup dersi detayı</Text>
          <Text style={styles.copy}>Ders: {String(params.lessonName || "Grup dersi")}</Text>
          <Text style={styles.copy}>Plan: {String(params.recurrenceLabel || params.specialDate || "Özel tarihli seans")}</Text>
          <Text style={styles.copy}>Bildirim: {getGroupClassAudienceLabel((params.notificationScope as "SALON_MEMBERS" | "INVITED_MEMBERS") || "SALON_MEMBERS")}</Text>
          <Text style={styles.copy}>Ücret: {formatGroupClassPrice(String(params.requestedPrice || params.amount || ""))}</Text>
          <Text style={styles.copy}>Davet edilen: {String(params.invitedMemberCount || "0")} • Katılan: {String(params.joinedMemberCount || "0")}</Text>
        </SurfaceCard>
      ) : null}
      <SurfaceCard>
        <Text style={styles.section}>Üye notu ve sonraki adım</Text>
        <Text style={styles.copy}>{detailNote || "Bu kayıt için ek serbest metin notu bırakılmamış."}</Text>
        <Text style={styles.copy}>Karar sonrası kullanıcı bilgilendirilir ve ilgili operasyon kaydı güncellenir.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.section}>Aksiyonlar</Text>
        <View style={styles.actions}>
          <ActionButton testID="admin-approval-approve" label="Onayla" icon="approvals" onPress={() => approveMutation.mutate("APPROVE")} loading={approveMutation.isPending} />
          <ActionButton testID="admin-approval-reject" label="Reddet" icon="risk" variant="danger" onPress={() => approveMutation.mutate("REJECT")} loading={approveMutation.isPending} />
        </View>
        <ActionButton label="Listeye dön" icon="notes" variant="ghost" onPress={() => safeBack(router, "/(admin)/approvals")} />
        <ActionButton label="Üyeleri aç" icon="members" variant="ghost" onPress={() => router.push("/(admin)/members" as never)} />
      </SurfaceCard>
    </AppShell>
  );
}

function resolveTypeLabel(type: string) {
  switch (type.toUpperCase()) {
    case "PAYMENT":
      return "Ödeme";
    case "CHANGE_REQUEST":
      return "Değişiklik";
    default:
      return "Başvuru";
  }
}

function resolveRequestTypeLabel(type: string) {
  switch (type.toUpperCase()) {
    case "PACKAGE_RENEWAL":
      return "Paket yenileme";
    case "PACKAGE_CANCEL":
      return "Paket iptali";
    case "TRAINER_CHANGE":
      return "Eğitmen değişikliği";
    case "GROUP_CLASS_CREATE":
      return "Grup dersi oluşturma";
    case "GROUP_CLASS_JOIN":
      return "Grup dersi katılımı";
    case "GROUP_CLASS_UPDATE":
      return "Grup dersi güncellemesi";
    case "GROUP_CLASS_CANCEL":
      return "Grup dersi iptali";
    case "DUO_PARTNER_PAYMENT":
      return "Duo partner ödemesi";
    case "PAYMENT":
      return "Ödeme onayı";
    default:
      return "Başvuru değerlendirmesi";
  }
}

function formatAmount(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Tutar bekleniyor";
  return `${new Intl.NumberFormat("tr-TR").format(numeric)} TL`;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zaman bilgisi yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
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
  actions: {
    gap: tokens.spacing.sm,
  },
});
