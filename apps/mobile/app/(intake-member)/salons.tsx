import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getPublıcSalonsApi, type SalonDiscoverySummary } from "@/lib/mobile-api";
import { buildSalonFeatureItems, buildSalonServiceHighlights, getSalonLocationLabel } from "@/lib/salon-discovery";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyState } from "@/theme/components/empty-state";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

export default function IntakeSalonsScreen() {
  const router = useRouter();
  const { memberIntent, memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const requestedCity = String(memberIntent.locationCity || "").trim();
  const salonsQuery = useQuery({
    queryKey: ["intake-salons", requestedCity],
    queryFn: () => getPublıcSalonsApi(requestedCity || undefined),
  });

  const salons = useMemo(() => (Array.isArray(salonsQuery.data) ? salonsQuery.data : []), [salonsQuery.data]);

  const sections = useMemo(() => {
    const boosted = salons.filter((salon) => salon.is_boosted);
    const regular = salons.filter((salon) => !salon.is_boosted);
    return [
      { key: "boosted", title: "Öne çıkan salonlar", data: boosted, accent: "Önerilen seçim" as const },
      { key: "regular", title: requestedCity ? `${requestedCity} için diğer seçenekler` : "Diğer seçenekler", data: regular, accent: undefined },
    ].filter((section) => section.data.length > 0);
  }, [requestedCity, salons]);

  return (
    <AppShell
      title="Salonunu seç"
      subtitle={requestedCity ? `${requestedCity} çevresinde sana daha uygun görünen salonları öne aldık.` : "Salonları hedefin, beklentin ve akış uyumuna göre sıraladık."}
      icon="salon"
      refreshing={salonsQuery.isRefetching}
      onRefresh={() => void salonsQuery.refetch()}
    >
      <AnimatedEntrance>
        <IntakeProgressCard
          step={2}
          total={6}
          icon="salon"
          eyebrow="Keşif özeti"
          title="Sana en uygun başlangıç listesini hazırladık"
          description={
            requestedCity
              ? `${requestedCity} çevresindeki seçenekleri önce öne aldık. Hedefin ve beklentine daha yakın salonları üstte görüyorsun.`
              : "Hedefin, beklentin ve ritmine göre daha dengeli bir ilk liste hazırladık."
          }
          badgeLabel={requestedCity || "Genel liste"}
          badgeTone="success"
          summaryItems={[
            { label: "Hedef", value: memberIntent.goal || "Belirtilmedi" },
            { label: "Beklenti", value: memberIntent.expectation || "Belirtilmedi" },
            { label: "Ritim", value: memberIntent.weeklyDays || "Belirtilmedi" },
          ]}
          footnote="Bir salon seçtiğinde detay, çalışma düzeni ve uygun paketler tek akışta açılır."
        />
      </AnimatedEntrance>

      {salons.length === 0 ? (
        <EmptyState
          title="Şu anda uygun salon görünmüyor"
          description="Bu kriterlerde listelenen bir salon bulamadık. Daha sonra tekrar deneyebilir veya konumsuz keşif ile devam edebilirsin."
          icon="salon"
        />
      ) : (
        sections.map((section) => (
          <View key={section.key} style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>{section.title}</Text>
            {section.data.map((salon, index) => (
              <AnimatedEntrance key={salon.slug} delay={120 + index * 70}>
                <SalonCard
                  salon={salon}
                  accent={section.accent}
                  onInspect={() => {
                    setMemberBookingDraft({
                      ...memberBookingDraft,
                      salonSlug: salon.slug,
                      salonName: salon.tenant_name || salon.name,
                    });
                    router.push(`/(intake-member)/salons/${salon.slug}` as never);
                  }}
                />
              </AnimatedEntrance>
            ))}
          </View>
        ))
      )}
    </AppShell>
  );
}

function SalonCard({
  salon,
  accent,
  onInspect,
}: {
  salon: SalonDiscoverySummary;
  accent?: string;
  onInspect: () => void;
}) {
  const locationLabel = getSalonLocationLabel(salon);
  const featureItems = buildSalonFeatureItems(salon);
  const serviceHighlights = buildSalonServiceHighlights(salon);

  return (
    <Pressable onPress={onInspect} style={({ pressed }) => [pressed ? styles.cardPressed : null]}>
      <SurfaceCard tone={salon.is_boosted ? "primary" : "default"} padding="hero">
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{salon.tenant_name || salon.name}</Text>
            <Text style={styles.cardMeta}>{locationLabel || "Konum bilgisi hazırlanıyor"}</Text>
          </View>
          {accent ? <Text style={styles.accentBadge}>{accent}</Text> : null}
        </View>

        <Text style={styles.cardCopy}>
          {salon.hero_subtitle || salon.about_text || "Planlı ders akışı, düzenli takip ve profesyonel bir salon deneyimi sunar."}
        </Text>

        <View style={styles.featureGrid}>
          {featureItems.map((item) => (
            <FeaturePill key={`${item.label}-${item.value}`} icon={item.icon} label={item.value} />
          ))}
        </View>

        {serviceHighlights.length > 0 ? (
          <View style={styles.serviceRow}>
            {serviceHighlights.map((service) => (
              <View key={service.title} style={styles.serviceCard}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.servicePrice}>{service.priceLabel}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardHint}>Detay, paket ve akış uyumunu gör</Text>
          <ActionButton label="Salonu incele" icon="salon" onPress={onInspect} />
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function FeaturePill({ icon, label }: { icon: "location" | "spark" | "trainer" | "clock"; label: string }) {
  return (
    <View style={styles.featurePill}>
      <AppIcon name={icon} size="sm" tone="primary" />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  sectionHeading: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }, { translateY: 1 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  cardMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  accentBadge: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    backgroundColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    overflow: "hidden",
  },
  cardCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  cardFooter: {
    gap: tokens.spacing.sm,
  },
  cardHint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  featureGrid: {
    gap: tokens.spacing.sm,
  },
  serviceRow: {
    gap: tokens.spacing.sm,
  },
  serviceCard: {
    width: "100%",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
  },
  serviceTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  servicePrice: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    marginTop: 4,
  },
  serviceDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginTop: 6,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.76)",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  featureLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
    flex: 1,
  },
});
