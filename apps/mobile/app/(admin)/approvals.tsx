// Bu sayfa mobil uygulamada admin akışındaki approvals ekranını temsil eder.
// Ekranın amacı ilgili roldeki kullanıcıya bu adımda gereken veri, karar veya aksiyonu sunmaktır.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminMobileApprovalsApi, type AdminApprovalItem } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { tokens } from "@/theme/tokens";

function formatAmount(value?: number | null) {
  if (typeof value !== "number") return "Tutar bekleniyor";
  return `${new Intl.NumberFormat("tr-TR").format(value)} TL`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Bugün açıldı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bugün açıldı";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusTone(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized.includes("APPRO")) return "success" as const;
  if (normalized.includes("REJECT")) return "danger" as const;
  return "warning" as const;
}

function getTypeLabel(type?: string) {
  switch (String(type || "").toUpperCase()) {
    case "PAYMENT":
      return "Ödeme";
    case "CHANGE_REQUEST":
      return "Değişiklik";
    default:
      return "Yeni başvuru";
  }
}

function isActiveMembershipPackagePurchase(item: AdminApprovalItem) {
  return String(item.type || "").toUpperCase() === "PAYMENT" && String(item.request_scope || "").toUpperCase() === "ACTIVE_MEMBERSHIP";
}

function getOperationalHint(item: AdminApprovalItem) {
  const normalizedType = String(item.type || "").toUpperCase();
  const normalizedRequestType = String(item.request_type || "").toUpperCase();
  if (normalizedRequestType.includes("GROUP_CLASS")) return "Katılım listesi, bildirim kapsamı ve ücret onayı birlikte kontrol edilmelidir.";
  if (item.is_duo) return "Duo pakette ilk ödeme %50 olarak onaylanır; partner daveti ve kalan ödeme tamamlanmadan ders akışı aktifleşmez.";
  if (isActiveMembershipPackagePurchase(item)) return "Bu kayıt yeni başvuru değil, mevcut üyeye eklenecek paket satışıdır. Onay sonrası aynı üyelikte yeni haklar açılır.";
  if (normalizedType === "PAYMENT") return "Ödeme doğrulanırsa üyelik ve plan aktivasyonu bir sonraki adıma geçer.";
  if (normalizedType === "CHANGE_REQUEST") return "Talep etkisi kontrol edilip takvim veya üyelik kaydı güncellenmelidir.";
  return "Başvuru içeriği, uygunluk ve operasyon notu birlikte değerlendirilmelidir.";
}

function getPrimaryDescription(item: AdminApprovalItem) {
  if (item.subtitle?.trim()) return item.subtitle.trim();
  if (item.is_duo) return "İkili ders paketi için partner bilgisi ve bölünmüş ödeme onayı bekleniyor.";
  if (item.is_group_class) return "Trainer tarafından açılan grup dersi için katılım ve ücret onayı bekleniyor.";
  if (isActiveMembershipPackagePurchase(item)) return "Mevcut üyeye ek paket satın alma talebi onay bekliyor.";
  if (item.type === "PAYMENT") return "Paket ödemesi doğrulama kuyruğunda bekliyor.";
  if (item.type === "CHANGE_REQUEST") return "Üye mevcut planı üzerinde güncelleme talep ediyor.";
  return "Yeni bir salon başvurusu operasyon onayı bekliyor.";
}

export default function AdminApprovalsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED">("PENDING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const query = useQuery({
    queryKey: ["admin-approvals-v2"],
    queryFn: getAdminMobileApprovalsApi,
  });
  const items = useMemo(() => (Array.isArray(query.data) ? query.data : []), [query.data]);
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusOk = statusFilter === "ALL" || String(item.status || "").toUpperCase().includes(statusFilter);
      const typeOk = typeFilter === "ALL" || String(item.type || "").toUpperCase() === typeFilter;
      return statusOk && typeOk;
    });
  }, [items, statusFilter, typeFilter]);
  const metrics = useMemo(
    () => ({
      pending: items.filter((item) => String(item.status || "").toUpperCase().includes("PENDING")).length,
      payments: items.filter((item) => String(item.type || "").toUpperCase() === "PAYMENT").length,
      changes: items.filter((item) => String(item.type || "").toUpperCase() === "CHANGE_REQUEST").length,
    }),
    [items],
  );
  const hasFilters = statusFilter !== "PENDING" || typeFilter !== "ALL";

  return (
    <AppShell title="Onaylar" subtitle="Başvuru, ödeme ve değişiklik taleplerini tek operasyonda yönet." icon="approvals" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.metricsRow}>
        <MetricCard label="Bekleyen" value={metrics.pending} hint="Aksiyon isteyen kayıt" icon="approvals" />
        <MetricCard label="Ödeme" value={metrics.payments} hint="Kontrol bekleyen" icon="wallet" />
      </View>
      <SurfaceCard style={styles.filterPanel} tone="primary" padding="regular">
        <View style={styles.filterHeader}>
          <View style={styles.filterHeaderCopy}>
            <Text style={styles.filterTitle}>Filtreler</Text>
            <Text style={styles.filterSubtitle}>Durum ve talep tipine göre listeyi daralt.</Text>
          </View>
          {hasFilters ? (
            <ActionButton
              label="Temizle"
              variant="ghost"
              fullWidth={false}
              onPress={() => {
                setStatusFilter("PENDING");
                setTypeFilter("ALL");
              }}
            />
          ) : null}
        </View>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Durum</Text>
          <SegmentedSwitch
            value={statusFilter}
            options={[
              { label: "Bekleyen", value: "PENDING" },
              { label: "Onaylı", value: "APPROVED" },
              { label: "Tümü", value: "ALL" },
            ]}
            onChange={(value) => setStatusFilter(value as typeof statusFilter)}
          />
        </View>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Talep tipi</Text>
          <View style={styles.typeRow}>
            {[
              { label: "Tümü", value: "ALL" },
              { label: "Başvuru", value: "APPLICATION" },
              { label: "Ödeme", value: "PAYMENT" },
              { label: "Değişiklik", value: "CHANGE_REQUEST" },
            ].map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setTypeFilter(option.value)}
                style={({ pressed }) => [
                  styles.typeButton,
                  typeFilter === option.value ? styles.typeButtonActive : null,
                  pressed ? styles.typeButtonPressed : null,
                ]}
              >
                <Text style={[styles.typeButtonLabel, typeFilter === option.value ? styles.typeButtonLabelActive : null]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SurfaceCard>
      {filteredItems.length === 0 ? (
        <EmptyState title="Bekleyen onay yok" description="Yeni başvurular ve değişiklik talepleri geldiğinde burada listelenecek." icon="approvals" />
      ) : (
        <ScrollPanel maxHeight={460} contentContainerStyle={styles.stack}>
          {filteredItems.map((item) => (
            <SurfaceCard key={item.id}>
              <View style={styles.row}>
                <Text style={styles.title}>{item.title}</Text>
                <StatusBadge label={item.status} tone={getStatusTone(item.status)} />
              </View>
              <Text style={styles.copy}>{getPrimaryDescription(item)}</Text>
              <View style={styles.metaRow}>
                <StatusBadge label={getTypeLabel(item.type)} tone={item.type === "PAYMENT" ? "info" : item.type === "CHANGE_REQUEST" ? "warning" : "success"} />
                {isActiveMembershipPackagePurchase(item) ? <StatusBadge label="Mevcut üyeye ek paket" tone="warning" /> : null}
                {item.is_duo ? <StatusBadge label="Duo %50 ödeme" tone="info" /> : null}
                <Text style={styles.meta}>{formatAmount(item.amount)}</Text>
                <Text style={styles.meta}>{formatDateLabel(item.created_at)}</Text>
              </View>
              {item.member_name || item.member_email ? (
                <Text style={styles.detail}>
                  {item.member_name || "Üye"}
                  {item.member_email ? ` • ${item.member_email}` : ""}
                </Text>
              ) : null}
              {item.is_group_class ? (
                <Text style={styles.detail}>
                  {item.lesson_name || "Grup dersi"} • {item.recurrence_label || item.special_date || "Özel tarih"} • {item.notification_scope === "INVITED_MEMBERS" ? "Davetli akışı" : "Salon geneli bildirimi"}
                </Text>
              ) : null}
              {item.is_duo ? (
                <Text style={styles.detail}>
                  Partner: {item.duo_partner_name || "Belirtilmedi"} • {item.duo_partner_contact || "İletişim bekleniyor"} • {item.duo_payment_status || "Partner ödemesi bekleniyor"}
                </Text>
              ) : null}
              <Text style={styles.hint}>{getOperationalHint(item)}</Text>
              <ActionButton
                testID={`admin-approval-open-${String(item.request_type || item.type || "approval")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`}
                label="Detayı aç"
                icon="approvals"
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/approval/[id]",
                    params: {
                      id: item.id,
                      title: item.title,
                      subtitle: item.subtitle || "",
                      status: item.status,
                      type: item.type,
                      amount: String(item.amount || ""),
                      memberName: item.member_name || "",
                      memberEmail: item.member_email || "",
                      note: item.note || "",
                      requestType: item.request_type || "",
                      requestScope: item.request_scope || "",
                      activeMembershipId: item.active_membership_id || "",
                      submittedAt: item.submitted_at || item.created_at || "",
                      lessonName: item.lesson_name || "",
                      isGroupClass: item.is_group_class ? "1" : "",
                      recurrenceLabel: item.recurrence_label || "",
                      specialDate: item.special_date || "",
                      requestedPrice: String(item.requested_price || item.amount || ""),
                      notificationScope: item.notification_scope || "",
                      invitedMemberCount: String(item.invited_member_count || ""),
                      joinedMemberCount: String(item.joined_member_count || ""),
                      isDuo: item.is_duo ? "1" : "",
                      duoPartnerName: item.duo_partner_name || "",
                      duoPartnerContact: item.duo_partner_contact || "",
                      duoPaymentStatus: item.duo_payment_status || "",
                      duoPaymentNote: item.duo_payment_note || "",
                      backTo: "/(admin)/approvals",
                    },
                  } as never)
                }
              />
            </SurfaceCard>
          ))}
        </ScrollPanel>
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
  filterPanel: {
    gap: tokens.spacing.md,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  filterHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  filterTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  filterSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  filterBlock: {
    gap: tokens.spacing.sm,
  },
  filterLabel: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  typeButton: {
    flex: 1,
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  typeButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryStrong,
    ...tokens.shadow.focus,
  },
  typeButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  typeButtonLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  typeButtonLabelActive: {
    color: "#FFFFFF",
  },
  stack: { gap: tokens.spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    flex: 1,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  detail: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
});
