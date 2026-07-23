// Bu sayfa member tarafında ders check-in için kullanılacak kişisel QR/MEM kodunu gösterir.
// Üye paket seçmez; eğitmen QR/MEM kodu okuttuğunda backend o saatteki dersin paketini otomatik çözer.
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMemberQrApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { QrPreview } from "@/theme/components/qr-preview";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { tokens } from "@/theme/tokens";

export default function MemberQrScreen() {
  const query = useQuery({
    queryKey: ["member-qr"],
    queryFn: getMemberQrApi,
  });

  const data = "data" in (query.data as any || {}) ? (query.data as any)?.data || {} : query.data || {};
  const currentCode = String(data.qr_code || "").trim();
  const activePackages = Array.isArray(data.active_packages) ? data.active_packages : [];

  const packageCount = activePackages.length;
  const totalRemainingCredits = activePackages.reduce((sum: number, pkg: any) => {
    return sum + Number(pkg.remaining_credits || 0);
  }, 0);

  const codeStatus = query.isError ? "Sorun var" : currentCode ? "Hazır" : "Bekleniyor";

  return (
    <AppShell
      title="QR kodum"
      subtitle="Derse girişte eğitmenin bu QR kodu okutur. Sistem o saatteki dersine göre doğru paketten otomatik hak düşer."
      icon="qr"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View style={styles.metricsRow}>
        <SurfaceCard style={{ ...styles.metricSurface, ...styles.metricSurfacePrimary }} padding="compact">
          <AppIcon name="salon" size="sm" tone="primary" />
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
            {data.salon_name || "Bağlı salon"}
          </Text>
          <Text style={styles.metricLabel}>Aktif salon</Text>
        </SurfaceCard>

        <SurfaceCard style={{ ...styles.metricSurface, ...styles.metricSurfaceSuccess }} padding="compact">
          <AppIcon name="checkin" size="sm" tone="success" />
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
            {codeStatus}
          </Text>
          <Text style={styles.metricLabel}>Kod durumu</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard tone="primary">
        <View style={styles.cardHeader}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <Text style={styles.sectionTitle}>Ders giriş QR kodu</Text>
        </View>

        <Text style={styles.copy}>
          Bu QR sadece seni tanımlar. Hangi paketten hak düşeceğine sen karar vermezsin; sistem ders saati, eğitmen ve ders tipine göre doğru paketi otomatik eşleştirir.
        </Text>

        <View style={styles.qrBox}>
          {query.isLoading && !currentCode ? (
            <ActivityIndicator color={tokens.colors.primaryStrong} />
          ) : query.isError ? (
            <View style={styles.qrState}>
              <EmptyPanel
                title="QR hazırlanamadı"
                description="Kod şu an alınamadı. Bağlantını kontrol edip tekrar dene."
                iconName="qr"
                iconTone="warning"
              />
              <ActionButton testID="member-qr-retry" label="Tekrar dene" icon="qr" onPress={() => void query.refetch()} />
            </View>
          ) : currentCode ? (
            <>
              <QrPreview value={currentCode} size={230} showCode={false} />

              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Manuel MEM kodu</Text>
                <Text style={styles.codeText} selectable>
                  {currentCode}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.qrState}>
              <EmptyPanel
                title="QR henüz hazır değil"
                description="Üyelik bilgilerin yüklendiğinde burada görünecek."
                iconName="qr"
                iconTone="neutral"
              />
            </View>
          )}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="package" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Paket eşleşmesi otomatik yapılır</Text>
        </View>

        <Text style={styles.copy}>
          Eğitmen kodunu okuttuğunda sistem o saatteki onaylı dersini bulur. Ders türüne uygun aktif paketin varsa 1 hak otomatik düşülür.
        </Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{packageCount}</Text>
            <Text style={styles.infoLabel}>Aktif paket</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{totalRemainingCredits}</Text>
            <Text style={styles.infoLabel}>Toplam hak</Text>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="shield" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Güvenli check-in</Text>
        </View>

        <Text style={styles.copy}>
          Aynı ders için tekrar okutma yapılırsa sistem ikinci kez hak düşmez. Kamera çalışmazsa eğitmen yukarıdaki MEM kodunu manuel olarak girebilir.
        </Text>
      </SurfaceCard>

    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  metricSurface: {
    flex: 1,
    minWidth: 0,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricSurfacePrimary: {
    backgroundColor: "#EFF6FF",
    borderColor: "rgba(59,130,246,0.18)",
  },
  metricSurfaceSuccess: {
    backgroundColor: "rgba(151,187,156,0.14)",
    borderColor: "rgba(151,187,156,0.24)",
  },
  metricValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  metricLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm,
  },
  qrBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  qrState: {
    width: "100%",
    gap: tokens.spacing.sm,
  },
  codeBox: {
    width: "100%",
    alignItems: "center",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.24)",
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  codeLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  codeText: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
    letterSpacing: 1.2,
  },
  infoGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    gap: 4,
  },
  infoValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  infoLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },
});
