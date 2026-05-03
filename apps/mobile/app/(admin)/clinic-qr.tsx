import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getAdminClinicQrApi } from "@/lib/mobile-api";
import { shareQrCodeImage } from "@/lib/qr-download";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { QrPreview } from "@/theme/components/qr-preview";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

type AdminClinicQrPayload = {
  tenant_id?: string | null;
  slug?: string | null;
  name?: string | null;
  qr_code?: string | null;
  qr_payload?: string | null;
  join_url?: string | null;
  detour_url?: string | null;
};

type AdminClinicQrResponse = AdminClinicQrPayload | { data?: AdminClinicQrPayload };

function unwrapQrData(payload: AdminClinicQrResponse | undefined): AdminClinicQrPayload {
  if (!payload) return {};
  if ("data" in payload && payload.data) return payload.data;
  return payload as AdminClinicQrPayload;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function resolveQrMode(detourUrl: string, joinUrl: string) {
  if (detourUrl) {
    return {
      label: "Detour aktif",
      tone: "success" as const,
      description:
        "Bu QR Detour yönlendirme linkini taşır. Uygulama yüklüyse salon kayıt akışını açar; yüklü değilse indirme ve sonrasında onboarding akışına devam etmeyi hedefler.",
      appMissingLabel: "Detour indirme/yönlendirme akışı",
    };
  }

  if (joinUrl) {
    return {
      label: "Web fallback",
      tone: "info" as const,
      description:
        "Detour linki bulunmadığı için QR web join linkini taşır. Kullanıcı uygulamaya manuel QR/kod akışı veya web yönlendirmesiyle devam eder.",
      appMissingLabel: "Web join linki",
    };
  }

  return {
    label: "Kod fallback",
    tone: "warning" as const,
    description:
      "QR yalnız salon kodunu taşıyor. Detour veya public web link ayarları tamamlandığında onboarding yönlendirmesi daha güçlü çalışır.",
    appMissingLabel: "Salon kodu",
  };
}

export default function AdminClinicQrScreen() {
  const [shareError, setShareError] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const query = useQuery({
    queryKey: ["admin-clinic-qr"],
    queryFn: getAdminClinicQrApi,
  });

  const data = unwrapQrData(query.data as AdminClinicQrResponse | undefined);
  const currentCode = normalizeText(data.qr_code);
  const joinUrl = normalizeText(data.join_url);
  const detourUrl = normalizeText(data.detour_url);
  const qrPayload = normalizeText(data.qr_payload || detourUrl || joinUrl || currentCode);
  const salonName = normalizeText(data.name) || "Salon";
  const salonSlug = normalizeText(data.slug) || "salon";
  const qrMode = resolveQrMode(detourUrl, joinUrl);

  async function handleDownloadQr() {
    if (!qrPayload || isSharing) return;

    try {
      setShareError("");
      setIsSharing(true);

      await shareQrCodeImage({
        value: qrPayload,
        fileName: `clinerva-salon-qr-${salonSlug}`,
        message: detourUrl
          ? `${salonName} salon QR görseli hazır. Bu QR Detour üzerinden uygulama indirme ve salon kayıt yönlendirmesi için kullanılabilir.`
          : `${salonName} salon QR görseli hazır. Bu QR salon kayıt linkini içerir.`,
      });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "QR görseli hazırlanamadı.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <AppShell
      title="Salon QR kodu"
      subtitle="Kartvizit, afiş veya resepsiyon alanında kullanabileceğin sabit salon onboarding QR kodu."
      icon="qr"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <SurfaceCard tone="primary">
        <View style={styles.heroHeader}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <View style={styles.grow}>
            <Text style={styles.title}>{salonName}</Text>
            <Text style={styles.copy}>{data.slug ? `Salon slug: ${salonSlug}` : "Salon kodu hazırlanıyor"}</Text>
          </View>
          <StatusBadge label={qrMode.label} tone={qrMode.tone} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <Text style={styles.section}>Onboarding QR</Text>
        </View>

        <Text style={styles.copy}>
          Bu QR yeni kullanıcıları doğru salon kayıt akışına taşır. Kartvizit, broşür, masaüstü stand veya sosyal medya görsellerinde kullanılabilir.
        </Text>

        <View style={styles.qrWrap}>
          {query.isLoading && !qrPayload ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={tokens.colors.primaryStrong} />
              <Text style={styles.copy}>Salon QR hazırlanıyor...</Text>
            </View>
          ) : query.isError ? (
            <View style={styles.qrState}>
              <EmptyPanel
                title="Salon QR alınamadı"
                description="Salon onboarding kodu şu an yüklenemedi."
                iconName="qr"
                iconTone="warning"
              />
              <ActionButton label="Tekrar dene" icon="qr" onPress={() => void query.refetch()} />
            </View>
          ) : qrPayload ? (
            <>
              <View style={styles.qrFrame}>
                <QrPreview value={qrPayload} size={230} showCode={false} />
              </View>

              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Salon kodu</Text>
                <Text style={styles.code}>{currentCode || "Kod hazır"}</Text>
              </View>
            </>
          ) : (
            <View style={styles.qrState}>
              <EmptyPanel
                title="Salon QR henüz hazır değil"
                description="Salon slug ve QR kaydı tamamlandığında burada görünecek."
                iconName="qr"
                iconTone="neutral"
              />
            </View>
          )}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="spark" size="sm" tone="primary" />
          <Text style={styles.section}>QR yönlendirme durumu</Text>
        </View>

        <Text style={styles.copy}>{qrMode.description}</Text>

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uygulama yüklüyse</Text>
            <Text style={styles.infoValue}>Salon kayıt ekranı açılır</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uygulama yoksa</Text>
            <Text style={styles.infoValue}>{qrMode.appMissingLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Yönlendirme tipi</Text>
            <Text style={styles.infoValue}>{detourUrl ? "Detour link" : joinUrl ? "Join link" : "Salon kodu"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kullanım alanı</Text>
            <Text style={styles.infoValue}>Kartvizit / afiş / resepsiyon</Text>
          </View>
        </View>

        <ActionButton
          label={isSharing ? "QR hazırlanıyor..." : "QR görselini indir / paylaş"}
          icon="download"
          onPress={() => void handleDownloadQr()}
          loading={isSharing}
          disabled={!qrPayload || query.isLoading || query.isError || isSharing}
        />

        {shareError ? <Text style={styles.error}>{shareError}</Text> : null}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.copy}>
          Not: Bu QR ders check-in QR’ı değildir. Üye veya eğitmen katılım işlemleri için ayrı QR/kod akışı kullanılır.
        </Text>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
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
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  qrWrap: {
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
  },
  qrFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrState: {
    width: "100%",
    gap: tokens.spacing.sm,
  },
  loadingBox: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  codeBox: {
    alignItems: "center",
    gap: 2,
  },
  codeLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  code: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  infoList: {
    gap: tokens.spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  infoLabel: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  infoValue: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "right",
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});