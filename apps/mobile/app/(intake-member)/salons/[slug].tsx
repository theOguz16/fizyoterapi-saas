import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { getPublıcSalonApi } from "@/lib/mobile-api";
import { buildSalonFeatureItems, buildSalonServiceHighlights, getSalonLocationLabel } from "@/lib/salon-discovery";
import { clearPendingSalonJoinSlug } from "@/lib/local-preferences";
import { useAppFlow } from "@/providers/app-flow";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

export default function SalonDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug || "").trim();

  const { memberIntent, memberBookingDraft, setMemberBookingDraft } = useAppFlow();

  const salonQuery = useQuery({
    queryKey: ["publıc-salon", slug],
    queryFn: () => getPublıcSalonApi(slug),
    enabled: Boolean(slug),
    retry: 1,
  });

  const salon = salonQuery.data;

  useEffect(() => {
    if (!slug || salonQuery.isError) {
      void clearPendingSalonJoinSlug();
      return;
    }
  }, [salonQuery.isError, slug]);

  const businessHours = resolveBusinessHours([salon?.business_hours]);
  const locationLabel = getSalonLocationLabel(salon);
  const featureItems = useMemo(() => buildSalonFeatureItems(salon, memberIntent), [memberIntent, salon]);
  const serviceHighlights = useMemo(() => buildSalonServiceHighlights(salon), [salon]);
  const workingHours = `${businessHours.start_time} - ${businessHours.end_time}`;
  const slotInfo = `${businessHours.slot_minutes} dk ders`;

  async function leaveSalonIntent(destination: "/(intake-member)" | "/(intake-member)/salons") {
    await clearPendingSalonJoinSlug();
    setMemberBookingDraft({ preferredSlots: [] });
    router.replace(destination as never);
  }

  if (!slug) {
    return (
      <AppShell title="Salon bağlantısı eksik" subtitle="Kliniğinin QR veya davetiyle yeniden bağlanabilirsin." icon="salon">
        <View testID="salon-not-found-screen" style={styles.stateWrap}>
          <View style={styles.stateIconWrap}>
            <AppIcon name="salon" size="lg" tone="primary" />
          </View>

          <Text style={styles.stateTitle}>Bağlantıda klinik bilgisi yok</Text>
          <Text style={styles.stateText}>
            Kliniğinden yeni bir FizyoFlow QR kodu, salon bağlantısı veya davet kodu iste.
          </Text>
          <ConnectionRecoveryActions router={router} />
        </View>
      </AppShell>
    );
  }

  if (salonQuery.isLoading || salonQuery.isFetching) {
    return (
      <AppShell title="Salon yükleniyor" subtitle="QR bağlantısı kontrol ediliyor." icon="salon">
        <View testID="salon-loading-screen" style={styles.stateWrap}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
          <Text style={styles.stateTitle}>Salon bilgileri hazırlanıyor</Text>
          <Text style={styles.stateText}>Bağlantıyı kontrol ediyoruz. Bu işlem birkaç saniye sürebilir.</Text>
        </View>
      </AppShell>
    );
  }

  if (salonQuery.isError || !salon) {
    return (
      <AppShell title="Klinik bağlantısı doğrulanamadı" subtitle="QR, salon linki veya davet koduyla tekrar deneyebilirsin." icon="salon">
        <View testID="salon-not-found-screen" style={styles.stateWrap}>
          <View style={styles.stateIconWrap}>
            <AppIcon name="salon" size="lg" tone="primary" />
          </View>

          <Text style={styles.stateTitle}>Salon bulunamadı</Text>
          <Text style={styles.stateText}>
            Bu bağlantı eski olabilir veya klinik şu anda yayında olmayabilir. Kliniğinden güncel QR ya da davet bağlantısı iste.
          </Text>

          <View style={styles.stateActions}>
            <ActionButton
              testID="salon-not-found-retry-button"
              label="Bağlantıyı tekrar kontrol et"
              icon="progress"
              variant="ghost"
              onPress={() => void salonQuery.refetch()}
            />
            <ConnectionRecoveryActions router={router} />
          </View>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={salon.tenant_name || salon.name || "Salon detayı"}
      subtitle="Ortamı, çalışma düzenini ve sana uygunluğunu net bir özetle incele."
      icon="salon"
    >
      <View testID="salon-detail-screen">
        <AnimatedEntrance>
          <IntakeProgressCard
            step={2}
            total={6}
            icon="salon"
            eyebrow="Salon detayı"
            title="Salon detayını inceliyorsun"
            description="Burada yalnız ilk izlenime değil; düzen, uzmanlık ve akış uyumuna birlikte bakmalısın."
            badgeLabel={memberIntent.expectation || "Salon değerlendirmesi"}
            badgeTone="success"
            summaryItems={[
              { label: "Beklenti", value: memberIntent.expectation || "Belirtilmedi" },
              { label: "Saat tercihi", value: memberIntent.timePreference || "Belirtilmedi" },
              { label: "Konum", value: locationLabel || "Hazırlanıyor" },
            ]}
            footnote="Salon sana uygunsa bir sonraki adımda açık paketleri ve planlama kurallarını göreceksin."
          />
        </AnimatedEntrance>

        <AnimatedEntrance delay={70}>
          <SurfaceCard tone="primary" padding="hero">
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  {salon.hero_title || "Düzenli, güvenli ve net ilerleyen bir salon deneyimi"}
                </Text>
                <Text style={styles.copy}>
                  {salon.hero_subtitle ||
                    salon.about_text ||
                    "Temiz ortam, anlaşılır operasyon ve üyeyi yormayan bir planlama yapısı sunar."}
                </Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <InfoRow icon="location" label="Konum" value={locationLabel || "Konum bilgisi hazırlanıyor"} />
              <InfoRow icon="clock" label="Çalışma saatleri" value={workingHours} />
              <InfoRow icon="calendar" label="Ders süresi" value={slotInfo} />
            </View>
          </SurfaceCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={130}>
          <SurfaceCard>
            <Text style={styles.section}>Bu salonda öne çıkanlar</Text>
            <View style={styles.highlightGrid}>
              {featureItems.map((item) => (
                <HighlightPill key={`${item.label}-${item.value}`} icon={item.icon} label={item.label} value={item.value} />
              ))}
            </View>
          </SurfaceCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={190}>
          <SurfaceCard>
            <Text style={styles.section}>Kısa değerlendirme</Text>
            <View style={styles.noteList}>
              <NoteRow icon="clock" text={`Çalışma düzeni ${workingHours} aralığında ilerliyor.`} />
              <NoteRow icon="calendar" text={`${slotInfo} üzerinden daha planlı bir ders akışı kuruluyor.`} />
              <NoteRow icon="spark" text="Paket seçiminden sonra yalnız sana uygun eğitmen ve saat eşleşmeleri açılıyor." />
            </View>
          </SurfaceCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={250}>
          <SurfaceCard>
            <Text style={styles.section}>Öne çıkan hizmetler</Text>
            <View style={styles.serviceList}>
              {serviceHighlights.length > 0 ? (
                serviceHighlights.map((service) => (
                  <View key={service.title} style={styles.serviceCard}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={styles.servicePrice}>{service.priceLabel}</Text>
                    </View>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.copy}>Paketler yayınlandıkça burada görünecek.</Text>
              )}
            </View>
          </SurfaceCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={310}>
          <View style={styles.footerBlock}>
            <Text style={styles.footerHint}>Salon sana uygunsa şimdi paket seçeneklerine geçebilirsin.</Text>
            <ActionButton
              testID="salon-view-packages-button"
              label="Paketleri gör"
              icon="package"
              onPress={() => {
                setMemberBookingDraft({
                  ...memberBookingDraft,
                  salonSlug: slug,
                  salonName: salon.tenant_name || salon.name,
                });

                router.push({
                  pathname: "/(intake-member)/packages",
                  params: { slug },
                } as never);
              }}
            />
            <ActionButton
              testID="salon-choose-another-button"
              label="Başka klinik seç"
              icon="salon"
              variant="ghost"
              onPress={() => void leaveSalonIntent("/(intake-member)/salons")}
            />
            <ActionButton
              testID="salon-cancel-connection-button"
              label="Bu bağlantıyı iptal et"
              icon="arrow-left"
              variant="ghost"
              onPress={() => void leaveSalonIntent("/(intake-member)")}
            />
          </View>
        </AnimatedEntrance>
      </View>
    </AppShell>
  );
}

function ConnectionRecoveryActions({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.connectionRecoveryActions}>
      <ActionButton
        testID="salon-not-found-scan-qr"
        label="Yeni salon QR kodunu okut"
        icon="scan"
        onPress={() => router.replace("/(auth)/scan-salon-qr" as never)}
      />
      <ActionButton
        testID="salon-not-found-enter-invite"
        label="Davet koduyla bağlan"
        icon="trainer"
        variant="ghost"
        onPress={() => router.replace("/(auth)/invite-accept" as never)}
      />
      <ActionButton
        testID="salon-not-found-discovery"
        label="Diğer klinikleri incele"
        icon="salon"
        variant="ghost"
        onPress={() => router.replace("/(intake-member)/salons" as never)}
      />
    </View>
  );
}

function HighlightPill({
  icon,
  label,
  value,
}: {
  icon: "location" | "spark" | "trainer" | "clock";
  label: string;
  value: string;
}) {
  return (
    <View style={styles.highlightCard}>
      <AppIcon name={icon} size="sm" tone="primary" />
      <View style={styles.highlightCopy}>
        <Text style={styles.highlightLabel}>{label}</Text>
        <Text style={styles.highlightValue}>{value}</Text>
      </View>
    </View>
  );
}

function NoteRow({ icon, text }: { icon: "clock" | "calendar" | "spark"; text: string }) {
  return (
    <View style={styles.noteRow}>
      <AppIcon name={icon} size="sm" tone="primary" />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: "location" | "clock" | "calendar"; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppIcon name={icon} size="sm" tone="primary" />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: tokens.spacing.sm,
  },
  headerCopy: {
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    lineHeight: 28,
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
  infoGrid: {
    gap: tokens.spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: tokens.spacing.md,
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  infoValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  serviceList: {
    gap: tokens.spacing.sm,
  },
  highlightGrid: {
    gap: tokens.spacing.sm,
  },
  highlightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: tokens.spacing.md,
  },
  highlightCopy: {
    flex: 1,
    gap: 2,
  },
  highlightLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  highlightValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  noteList: {
    gap: tokens.spacing.sm,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  noteText: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  serviceCard: {
    width: "100%",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  serviceTitle: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  servicePrice: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  serviceDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  tag: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagLabel: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  footerBlock: {
    gap: tokens.spacing.sm,
  },
  footerHint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  stateWrap: {
    flex: 1,
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.14)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.22)",
  },
  stateTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    lineHeight: 26,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  stateText: {
    maxWidth: 310,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    textAlign: "center",
  },
  stateActions: {
    width: "100%",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  connectionRecoveryActions: { width: "100%", gap: tokens.spacing.sm },
});
