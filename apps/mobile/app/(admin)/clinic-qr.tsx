import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import { getAdminClinicQrApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { QrPreview } from "@/theme/components/qr-preview";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";
import { trackProductEvent } from "@/lib/product-analytics";
import { getClinicActivationNextRoute, isClinicActivationFlow } from "@/lib/clinic-activation";

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
      label: "Yönlendirme hazır",
      tone: "success" as const,
      description:
        "Danışanlar bu QR kodu okuttuğunda doğrudan salon sayfana yönlendirilir. Uygulama yüklüyse FizyoFlow açılır; yüklü değilse indirme akışıyla devam eder.",
      appInstalledLabel: "Salon sayfan açılır",
      appMissingLabel: "İndirme sayfası açılır",
      routeTypeLabel: "Akıllı yönlendirme",
    };
  }

  if (joinUrl) {
    return {
      label: "Paylaşım hazır",
      tone: "info" as const,
      description:
        "Danışanlar bu QR kodu okuttuğunda salon kayıt bağlantına yönlendirilir. Bu bağlantıyı kartvizit, afiş ve sosyal medya görsellerinde kullanabilirsin.",
      appInstalledLabel: "Salon kayıt sayfan açılır",
      appMissingLabel: "Salon kayıt bağlantısı açılır",
      routeTypeLabel: "Salon bağlantısı",
    };
  }

  return {
    label: "Kurulum bekliyor",
    tone: "warning" as const,
    description:
      "Salon QR kodu temel salon kodunu taşıyor. Bağlantı ayarları tamamlandığında danışanlar doğrudan salon sayfana yönlendirilebilir.",
    appInstalledLabel: "Salon kodu gösterilir",
    appMissingLabel: "Salon kodu gösterilir",
    routeTypeLabel: "Salon kodu",
  };
}

export default function AdminClinicQrScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[]; activation?: string | string[] }>();
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const qrShotRef = useRef<ViewShot>(null);

  const query = useQuery({
    queryKey: ["admin-clinic-qr"],
    queryFn: getAdminClinicQrApi,
  });

  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const activation = isClinicActivationFlow(params.activation);
  const data = unwrapQrData(query.data as AdminClinicQrResponse | undefined);
  const currentCode = normalizeText(data.qr_code);
  const joinUrl = normalizeText(data.join_url);
  const detourUrl = normalizeText(data.detour_url);
  const qrPayload = normalizeText(data.qr_payload || detourUrl || joinUrl || currentCode);
  const salonName = normalizeText(data.name) || "Salon";
  const qrMode = resolveQrMode(detourUrl, joinUrl);

  useEffect(() => {
    if (!qrPayload) return;
    void trackProductEvent(
      "clinic_qr_viewed",
      { screen: "admin_clinic_qr" },
      { oncePerSession: true, dedupeKey: "clinic_qr_viewed" }
    );
  }, [qrPayload]);

  async function handleSaveQr() {
    if (!qrPayload || isSaving) return;
    void trackProductEvent("member_invite_started", {
      screen: "admin_clinic_qr",
      source: "save_qr",
    });

    try {
      setFeedback("");
      setIsSaving(true);

      if (!qrShotRef.current) {
        throw new Error("QR görseli henüz hazır değil. Lütfen birkaç saniye sonra tekrar dene.");
      }

      const permission = await MediaLibrary.requestPermissionsAsync(true);

      if (!permission.granted) {
        throw new Error("QR görselini galeriye kaydetmek için fotoğraf izni vermelisin.");
      }

      const fileUri = await captureRef(qrShotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      await MediaLibrary.saveToLibraryAsync(fileUri);

      setFeedback("QR görseli galeriye kaydedildi.");
      Alert.alert("QR kaydedildi", "Salon QR görseli galeriye kaydedildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR görseli kaydedilemedi. Lütfen tekrar dene.";
      setFeedback(message);
      Alert.alert("QR kaydedilemedi", message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShareQr() {
    const shareUrl = joinUrl || detourUrl || qrPayload;
    if (!shareUrl || isSharing) return;

    try {
      setIsSharing(true);
      void trackProductEvent("member_invite_started", {
        screen: "admin_clinic_qr",
        source: "share_qr_link",
      });
      await Share.share({
        title: `${salonName} · FizyoFlow`,
        message: `${salonName} kliniğine FizyoFlow üzerinden katıl: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert("Paylaşım açılamadı", "Klinik bağlantısı şu anda paylaşılamadı. Lütfen tekrar dene.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <AppShell
      testID={activation ? "admin-clinic-activation-step-4" : "admin-clinic-qr-screen"}
      title={activation ? "QR paylaşımı" : "Salon QR kodu"}
      subtitle="Danışanların salon sayfana hızlıca ulaşsın diye QR kodunu galeriye kaydedebilirsin."
      icon="qr"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onBack={() => router.replace((backTo || "/(admin)/dashboard") as never)}
    >
      {activation ? (
        <SurfaceCard tone="primary">
          <Text style={styles.title}>4 / 4 · Kliniğin paylaşılmaya hazır</Text>
          <Text style={styles.copy}>QR veya klinik bağlantısını paylaşarak ilk danışanını doğru kliniğe yönlendir.</Text>
        </SurfaceCard>
      ) : null}
      <SurfaceCard tone="primary">
        <View style={styles.heroBlock}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <View style={styles.heroIconWrap}>
                <AppIcon name="qr" size="sm" tone="primary" />
              </View>

              <Text style={styles.title} numberOfLines={1}>
                {salonName}
              </Text>
            </View>

            <StatusBadge label={qrMode.label} tone={qrMode.tone} />
          </View>

          <Text style={styles.copy}>
            Bu QR kodu kartvizit, afiş, resepsiyon alanı veya sosyal medya tasarımlarında kullanabilirsin.
          </Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <Text style={styles.section}>Salon QR</Text>
        </View>

        <Text style={styles.copy}>
          Danışanlar bu kodu okuttuğunda salon sayfana yönlendirilir. Böylece kayıt ve paket seçim akışına daha hızlı
          başlayabilirler.
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
                description="QR kodu şu an yüklenemedi. Lütfen tekrar dene."
                iconName="qr"
                iconTone="warning"
                actionLabel="Tekrar dene"
                actionIcon="progress"
                actionTestID="admin-clinic-qr-empty-retry"
                onAction={() => void query.refetch()}
              />
            </View>
          ) : qrPayload ? (
            <>
              <ViewShot ref={qrShotRef} options={{ format: "png", quality: 1 }} style={styles.qrShot}>
                <View testID="admin-clinic-qr-preview" collapsable={false} style={styles.qrFrame}>
                  <QrPreview value={qrPayload} size={230} showCode={false} />

                  <Text style={styles.qrBrand}>FizyoFlow</Text>
                  <Text style={styles.qrSalonName} numberOfLines={1}>
                    {salonName}
                  </Text>
                  {currentCode ? <Text style={styles.qrCodeSmall}>{currentCode}</Text> : null}
                </View>
              </ViewShot>

              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Salon kodu</Text>
                <Text style={styles.code}>{currentCode || "Hazır"}</Text>
              </View>
            </>
          ) : (
            <View style={styles.qrState}>
              <EmptyPanel
                title="Salon QR henüz hazır değil"
                description="Salon bilgilerini tamamladığında danışan kayıt bağlantın ve QR kodun burada oluşur."
                iconName="qr"
                iconTone="neutral"
                actionLabel="Salon bilgilerini tamamla"
                actionIcon="clinic"
                actionTestID="admin-clinic-qr-empty-open-salon"
                onAction={() => router.push({ pathname: "/(admin)/salon", params: { backTo: "/(admin)/clinic-qr" } } as never)}
              />
            </View>
          )}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="spark" size="sm" tone="primary" />
          <Text style={styles.section}>QR nasıl çalışır?</Text>
        </View>

        <Text style={styles.copy}>{qrMode.description}</Text>

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uygulama yüklüyse</Text>
            <Text style={styles.infoValue}>{qrMode.appInstalledLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uygulama yoksa</Text>
            <Text style={styles.infoValue}>{qrMode.appMissingLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bağlantı türü</Text>
            <Text style={styles.infoValue}>{qrMode.routeTypeLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nerede kullanılır?</Text>
            <Text style={styles.infoValue}>Kartvizit / afiş / resepsiyon</Text>
          </View>
        </View>

        <ActionButton
          testID="admin-clinic-qr-share-button"
          label="Klinik bağlantısını paylaş"
          icon="external"
          onPress={() => void handleShareQr()}
          loading={isSharing}
          disabled={!qrPayload || query.isLoading || query.isError || isSharing}
        />

        <ActionButton
          testID="admin-clinic-qr-save-button"
          label={isSaving ? "QR kaydediliyor..." : "QR’ı galeriye kaydet"}
          icon="download"
          onPress={() => void handleSaveQr()}
          loading={isSaving}
          disabled={!qrPayload || query.isLoading || query.isError || isSaving}
        />

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </SurfaceCard>

      {activation && qrPayload ? (
        <SurfaceCard testID="admin-clinic-activation-complete" tone="success">
          <Text style={styles.section}>Dört adım tamamlandı</Text>
          <Text style={styles.copy}>Kliniğin, ilk paketin, çalışma saatlerin ve paylaşılabilir QR'ın hazır. Artık plan veya ücretsiz deneme seçeneğini değerlendirebilirsin.</Text>
          <ActionButton
            testID="admin-clinic-activation-review-plan"
            label="Plan ve denemeyi incele"
            icon="subscription"
            onPress={() => router.replace(getClinicActivationNextRoute("qr") as never)}
          />
          <ActionButton
            testID="admin-clinic-activation-dashboard"
            label="Yönetim merkezine geç"
            icon="dashboard"
            variant="ghost"
            onPress={() => router.replace("/(admin)/dashboard" as never)}
          />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="scan" size="sm" tone="primary" />
          <Text style={styles.section}>Kullanım notu</Text>
        </View>

        <Text style={styles.copy}>
          Bu QR kod salon tanıtımı ve kayıt yönlendirmesi içindir. Ders girişleri ve yoklama işlemleri için eğitmen
          ekranındaki ayrı QR/kod akışı kullanılır.
        </Text>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    gap: tokens.spacing.sm,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.14)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  title: {
    flexShrink: 1,
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
  qrShot: {
    backgroundColor: "#FFFFFF",
    borderRadius: tokens.radius.xl,
  },
  qrFrame: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.xl,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
  },
  qrBrand: {
    marginTop: tokens.spacing.sm,
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  qrSalonName: {
    marginTop: 2,
    maxWidth: 230,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  qrCodeSmall: {
    marginTop: 2,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
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
  feedback: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});
