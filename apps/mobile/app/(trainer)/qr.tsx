import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getTrainerQrApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { QrPreview } from "@/theme/components/qr-preview";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { tokens } from "@/theme/tokens";

export default function TrainerQrScreen() {
  const query = useQuery({
    queryKey: ["trainer-qr"],
    queryFn: getTrainerQrApi,
  });

  const data = "data" in (query.data as any || {}) ? (query.data as any)?.data || {} : query.data || {};
  const currentCode = String(data.qr_code || "").trim();

  return (
    <AppShell
      title="Eğitmen kimlik QR’ı"
      subtitle="Bu kod ders check-in için kullanılmaz. Admin gerektiğinde eğitmen kimliğini ve salon içi yetkini doğrulamak için okutur."
      icon="qr"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <SurfaceCard tone="primary">
        <View style={styles.header}>
          <AppIcon name="trainer" size="sm" tone="primary" />
          <View style={styles.grow}>
            <Text style={styles.title}>{data.full_name || "Eğitmen"}</Text>
            <Text style={styles.copy}>{data.email || "E-posta bilgisi bulunamadı"}</Text>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <Text style={styles.section}>Personel doğrulama kodu</Text>
        </View>

        <Text style={styles.copy}>
          Bu QR, yalnızca eğitmen hesabını doğrulamak için kullanılır. Üye ders katılımı için üyenin kendi QR/MEM kodu okutulmalıdır.
        </Text>

        <View style={styles.qrWrap}>
          {query.isLoading && !currentCode ? (
            <ActivityIndicator color={tokens.colors.primaryStrong} />
          ) : query.isError ? (
            <View style={styles.qrState}>
              <EmptyPanel
                title="Eğitmen QR alınamadı"
                description="Kimlik doğrulama kodu şu an yüklenemedi."
                iconName="qr"
                iconTone="warning"
              />
              <ActionButton label="Tekrar dene" icon="qr" onPress={() => void query.refetch()} />
            </View>
          ) : currentCode ? (
            <>
              <QrPreview value={currentCode} size={230} showCode={false} />
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Eğitmen MEM kodu</Text>
                <Text style={styles.code} selectable>
                  {currentCode}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.qrState}>
              <EmptyPanel
                title="Eğitmen QR henüz hazır değil"
                description="Salon içi doğrulama kodu üretildiğinde burada görünecek."
                iconName="qr"
                iconTone="neutral"
              />
            </View>
          )}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.header}>
          <AppIcon name="shield" size="sm" tone="neutral" />
          <Text style={styles.section}>Kullanım kuralı</Text>
        </View>
        <Text style={styles.copy}>
          Ders katılımı işlemlerinde üyenin QR/MEM kodu okutulur. Bu ekran sadece eğitmenin kimlik doğrulama QR’ıdır.
        </Text>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
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
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
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
  code: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: 1.2,
    textAlign: "center",
  },
});