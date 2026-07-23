import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getPublıcSalonsApi, type SalonDiscoverySummary } from "@/lib/mobile-api";
import { buildSalonFeatureItems, buildSalonServiceHighlights, getSalonDiscoveryEmptyGuidance, getSalonLocationLabel } from "@/lib/salon-discovery";
import { useAppFlow } from "@/providers/app-flow";
import { setPendingSalonJoinSlug } from "@/lib/local-preferences";
import { AppShell } from "@/theme/components/app-shell";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { AppIcon } from "@/theme/components/app-icon";
import { EmptyState } from "@/theme/components/empty-state";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

export default function IntakeSalonsScreen() {
  const router = useRouter();
  const { memberIntent, setMemberBookingDraft } = useAppFlow();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const requestedCity = String(memberIntent.locationCity || "").trim();
  const requestedDistrict = String(memberIntent.locationDistrict || "").trim();
  const salonsQuery = useQuery({
    queryKey: ["intake-salons", "all"],
    queryFn: () => getPublıcSalonsApi(),
  });

  const salons = useMemo(() => (Array.isArray(salonsQuery.data) ? salonsQuery.data : []), [salonsQuery.data]);
  const cityOptions = useMemo(() => {
    const values = salons.map((salon) => getSalonCity(salon)).filter(Boolean);
    return ["ALL", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "tr"))];
  }, [salons]);
  const serviceOptions = useMemo(() => {
    const values = salons
      .flatMap((salon) => (Array.isArray(salon.services) ? salon.services : []))
      .map((service) => String(service.title || "").trim())
      .filter(Boolean);
    return ["ALL", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "tr")).slice(0, 8)];
  }, [salons]);
  const filteredSalons = useMemo(() => {
    const query = normalizeLocationKey(search);
    return salons.filter((salon) => {
      const locationLabel = getSalonLocationLabel(salon);
      const city = getSalonCity(salon);
      const services = Array.isArray(salon.services) ? salon.services : [];
      const haystack = normalizeLocationKey(
        [
          salon.tenant_name,
          salon.name,
          salon.hero_title,
          salon.hero_subtitle,
          salon.about_text,
          locationLabel,
          ...services.map((service) => service.title),
        ]
          .filter(Boolean)
          .join(" ")
      );
      const searchOk = !query || haystack.includes(query);
      const cityOk = cityFilter === "ALL" || city === cityFilter;
      const serviceOk = serviceFilter === "ALL" || services.some((service) => String(service.title || "").trim() === serviceFilter);
      return searchOk && cityOk && serviceOk;
    });
  }, [cityFilter, salons, search, serviceFilter]);
  const hasActiveFilters = Boolean(search.trim() || cityFilter !== "ALL" || serviceFilter !== "ALL");
  const emptyGuidance = getSalonDiscoveryEmptyGuidance(salons.length > 0, hasActiveFilters);

  function clearFilters() {
    setSearch("");
    setCityFilter("ALL");
    setServiceFilter("ALL");
  }

  const sections = useMemo(() => {
    const requestedCityKey = normalizeLocationKey(requestedCity);
    const requestedDistrictKey = normalizeLocationKey(requestedDistrict);
    const hasLocationSignal = Boolean(requestedCityKey || requestedDistrictKey);
    const sortSalons = (items: SalonDiscoverySummary[]) =>
      [...items].sort((a, b) => {
        if (a.is_boosted === b.is_boosted) return (a.tenant_name || a.name).localeCompare(b.tenant_name || b.name, "tr");
        return a.is_boosted ? -1 : 1;
      });

    if (!hasLocationSignal) {
      return [{ key: "all", title: "Tüm salonlar", data: sortSalons(filteredSalons), accent: undefined }];
    }

    const nearby = filteredSalons.filter((salon) => isNearbySalon(salon, requestedCityKey, requestedDistrictKey));
    const nearbySlugs = new Set(nearby.map((salon) => salon.slug));
    const other = filteredSalons.filter((salon) => !nearbySlugs.has(salon.slug));

    return [
      { key: "nearby", title: "Şehir/ilçe eşleşen salonlar", data: sortSalons(nearby), accent: "Eşleşiyor" as const },
      { key: "other", title: nearby.length > 0 ? "Diğer salonlar" : "Diğer salonlar", data: sortSalons(other), accent: undefined },
    ].filter((section) => section.data.length > 0);
  }, [filteredSalons, requestedCity, requestedDistrict]);

  return (
    <AppShell
      testID="member-salons-screen"
      title="Kliniğini bul"
      subtitle={
        requestedCity
          ? `${[requestedCity, requestedDistrict].filter(Boolean).join(" / ")} çevresindeki yayınlanmış klinikleri alternatif keşif listesinde öne aldık.`
          : "Kliniğinin QR veya daveti yoksa yayınlanmış klinikleri ikincil olarak inceleyebilirsin."
      }
      icon="salon"
      refreshing={salonsQuery.isRefetching}
      onRefresh={() => void salonsQuery.refetch()}
    >
      <View style={styles.connectionBand}>
        <View style={styles.connectionHeading}>
          <AppIcon name="scan" size="sm" tone="primary" />
          <View style={styles.connectionCopy}>
            <Text style={styles.connectionTitle}>Kliniğin seni davet ettiyse doğrudan bağlan</Text>
            <Text style={styles.connectionText}>QR kodu, salon bağlantısı veya davet kodu doğru kliniği ve paket akışını otomatik açar.</Text>
          </View>
        </View>
        <View style={styles.connectionActions}>
          <ActionButton testID="member-salons-scan-qr" label="Salon QR okut" icon="scan" onPress={() => router.push("/(auth)/scan-salon-qr" as never)} />
          <ActionButton testID="member-salons-enter-invite" label="Davet kodu gir" icon="trainer" variant="ghost" onPress={() => router.push("/(auth)/invite-accept" as never)} />
        </View>
      </View>

      <AnimatedEntrance>
        <IntakeProgressCard
          step={2}
          total={6}
          icon="salon"
          eyebrow="Alternatif keşif"
          title="Henüz bir kliniğin yoksa seçenekleri incele"
          description={
            requestedCity
              ? "Şehir ve ilçe eşleşen klinikleri önce gösteriyoruz. Kayıt bağlantısını seçtiğin klinikten doğrulaman gerekebilir."
              : "Yayınlanmış klinikleri karşılaştırabilirsin. Mevcut kliniğin varsa en hızlı ve doğru yol kliniğinin QR veya davetidir."
          }
          badgeLabel={requestedCity ? [requestedCity, requestedDistrict].filter(Boolean).join(" / ") : "Tüm salonlar"}
          badgeTone="success"
          summaryItems={[
            { label: "Hedef", value: memberIntent.goal || "Belirtilmedi" },
            { label: "Beklenti", value: memberIntent.expectation || "Belirtilmedi" },
            { label: "Ritim", value: memberIntent.weeklyDays || "Belirtilmedi" },
          ]}
          footnote="Bir salon seçtiğinde detay, çalışma düzeni ve uygun paketler tek akışta açılır."
        />
      </AnimatedEntrance>

      <SurfaceCard>
        <FormField label="Salon ara" value={search} onChangeText={setSearch} placeholder="Salon, ilçe veya hizmet ara" />
        <View style={styles.filterRow}>
          {cityOptions.map((city) => (
            <SelectionChip key={city} label={city === "ALL" ? "Tüm şehirler" : city} active={cityFilter === city} onPress={() => setCityFilter(city)} />
          ))}
        </View>
        <View style={styles.filterRow}>
          {serviceOptions.map((service) => (
            <SelectionChip key={service} label={service === "ALL" ? "Tüm hizmetler" : service} active={serviceFilter === service} onPress={() => setServiceFilter(service)} />
          ))}
        </View>
      </SurfaceCard>

      {salons.length === 0 ? (
        <EmptyState
          title={emptyGuidance.title}
          description={emptyGuidance.description}
          icon="salon"
          actionLabel="Salon QR kodunu okut"
          actionIcon="scan"
          actionTestID="member-salons-empty-scan-qr"
          onAction={() => router.push("/(auth)/scan-salon-qr" as never)}
        />
      ) : filteredSalons.length === 0 ? (
        <EmptyState
          title={emptyGuidance.title}
          description={emptyGuidance.description}
          icon="salon"
          actionLabel="Filtreleri temizle"
          actionIcon="progress"
          actionTestID="member-salons-empty-clear-filters"
          onAction={clearFilters}
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
                    void setPendingSalonJoinSlug(salon.slug, "DISCOVERY");
                    setMemberBookingDraft({
                      salonSlug: salon.slug,
                      salonName: salon.tenant_name || salon.name,
                      entryContext: "DISCOVERY",
                      preferredSlots: [],
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

function normalizeLocationKey(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

function getSalonCity(salon: SalonDiscoverySummary) {
  const location = salon.location && typeof salon.location === "object" ? salon.location : null;
  return String(salon.city || location?.city || "").trim();
}

function isNearbySalon(salon: SalonDiscoverySummary, requestedCityKey: string, requestedDistrictKey: string) {
  const location = salon.location && typeof salon.location === "object" ? salon.location : null;
  const salonCityKey = normalizeLocationKey(String(salon.city || location?.city || ""));
  const salonDistrictKey = normalizeLocationKey(String(salon.district || location?.district || ""));

  if (requestedDistrictKey && salonDistrictKey && salonDistrictKey === requestedDistrictKey) {
    return true;
  }

  return Boolean(requestedCityKey && salonCityKey && salonCityKey === requestedCityKey);
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
    <View testID={`member-salon-card-${salon.slug}`}>
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
          <ActionButton testID={`member-salon-open-${salon.slug}`} label="Salonu incele" icon="salon" onPress={onInspect} />
        </View>
      </SurfaceCard>
    </View>
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
  connectionBand: {
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  connectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.sm },
  connectionCopy: { flex: 1, gap: tokens.spacing.xs },
  connectionTitle: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  connectionText: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  connectionActions: { gap: tokens.spacing.sm },
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
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
