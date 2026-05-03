import { useState } from "react";
import { useRouter } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { tokens } from "@/theme/tokens";

let LocationModule: any = null;
try {
  LocationModule = eval("require")("expo-location");
} catch {
  LocationModule = null;
}

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { memberIntent, setMemberIntent } = useAppFlow();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function goNext(allowLocation: boolean, city = "", district = "") {
    setMemberIntent({ ...memberIntent, allowLocation, locationCity: city, locationDistrict: district });
    router.replace("/(intake-member)/salons" as never);
  }

  async function handleAllowLocation() {
    if (!LocationModule?.requestForegroundPermissionsAsync) {
      setError("Konum servisi bu cihazda kullanılamıyor. Şimdilik konumsuz devam edebilirsin.");
      goNext(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const permission = await LocationModule.requestForegroundPermissionsAsync();
      if (permission?.status !== "granted") {
        setError("Konum izni verilmedi. İstersen daha sonra ayarlardan açabilirsin.");
        goNext(false);
        return;
      }

      const position = await LocationModule.getCurrentPositionAsync({});
      const geocoded = await LocationModule.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const first = Array.isArray(geocoded) ? geocoded[0] || {} : {};
      const city = String(first.city || first.region || "").trim();
      const district = String(first.district || first.subregion || "").trim();
      goNext(true, city, district);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konum alınamadı. Şimdilik konumsuz devam edebilirsin.");
      goNext(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingShell
      title="Yakınındaki salonları gösterelim"
      subtitle="Konumunu açarsan sana yakın salonları önce gösterir, ilk listeyi daha isabetli hazırlarız."
      icon="location"
      footer={
        <View style={styles.footer}>
          <ActionButton label="Konuma izin ver" icon="location" onPress={() => void handleAllowLocation()} loading={loading} />
          <ActionButton label="Şimdilik atla" icon="spark" variant="ghost" onPress={() => goNext(false)} />
        </View>
      }
    >
      <IntakeProgressCard
        step={1}
        total={6}
        icon="location"
        eyebrow="İsteğe bağlı adım"
        title="Yakın seçenekleri daha hızlı öne çıkaralım"
        description="Konum izni verirsen şehir ve ilçe bazında daha tutarlı bir ilk liste hazırlarız. İzin vermezsen akış aynı şekilde devam eder."
        badgeLabel="Hızlı keşif"
        badgeTone="success"
        summaryItems={[
          { label: "Konum", value: memberIntent.locationCity || "Henüz paylaşılmadı" },
          { label: "Durum", value: memberIntent.allowLocation ? "Açık" : "İsteğe bağlı" },
          { label: "Sonraki adım", value: "Salon listesi" },
        ]}
        footnote="Konumu yalnız ilk keşif listesini iyileştirmek için kullanırız."
      />

      <SurfaceCard tone="primary" padding="hero">
        <View style={styles.featureGrid}>
          <FeatureItem icon="location" title="Yakın salonlar önce gelir" description="Listeleme bulunduğun bölgeye göre daha anlamlı başlar." />
          <FeatureItem icon="spark" title="Daha kısa ilk karşılaştırma" description="Sana uymayan uzak seçenekler geri planda kalır." />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Veri kullanımı</Text>
        <Text style={styles.note}>Konum bilgisi yalnızca keşif listesini iyileştirmek için kullanılır. Daha sonra cihaz ayarlarından bu izni yeniden açabilirsin.</Text>
        <ActionButton label="Ayarları aç" icon="profile" variant="ghost" onPress={() => void Linking.openSettings()} />
      </SurfaceCard>
    </MarketingShell>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: "location" | "spark";
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <AppIcon name={icon} size="sm" tone="primary" variant="plain" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: tokens.spacing.sm },
  featureGrid: {
    gap: tokens.spacing.sm,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.74)",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(111,146,116,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  featureDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  note: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
