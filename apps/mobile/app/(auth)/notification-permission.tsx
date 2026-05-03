// Bu sayfa mobil uygulamada auth akışındaki bildirim izni adımını temsil eder.
// Rol bazlı değer önerisini korurken kullanıcıyı gereksiz tekrarlarla yormadan ilerletir.
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/providers/auth-session";
import { resolveRoleHome } from "@/lib/navigation";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import type { SessionRole } from "@/lib/mobile-api";

type PermissionContent = {
  title: string;
  subtitle: string;
  primaryCopy: string;
  secondaryCopy: string;
  metrics: Array<{
    label: string;
    value: string;
    hint: string;
    icon: "calendar" | "notifications" | "members" | "earnings" | "package" | "approvals";
  }>;
};

const CONTENT_BY_ROLE: Record<SessionRole, PermissionContent> = {
  ADMIN: {
    title: "Salon yönetimini kaçırma",
    subtitle: "Onaylar, riskli üyeler ve kampanya akışları için kritik sinyalleri zamanında al.",
    primaryCopy: "Yönetici olarak yeni başvuru, riskli üye ve operasyon uyarılarını anında görmen salon akışını hızlandırır.",
    secondaryCopy: "İzin verirsen onay bekleyen işlemler, paket yenileme fırsatları ve yoğun saat hatırlatmaları daha görünür olur.",
    metrics: [
      { label: "Onay akışı", value: "Anlık", hint: "Yeni başvurular", icon: "approvals" },
      { label: "Operasyon", value: "Risk / yoğunluk", hint: "Salon takibi", icon: "notifications" },
    ],
  },
  TRAINER: {
    title: "Programın seninle aksın",
    subtitle: "Yeni ders atamaları, iptaller ve danışan hatırlatmaları için bildirimleri açık tut.",
    primaryCopy: "Eğitmen olarak program değişikliklerini ve yaklaşan seanslarını zamanında görmek gününü daha kontrollü yürütmeni sağlar.",
    secondaryCopy: "İzin verirsen ders atamaları, check-in yoğunluğu ve danışan notları için öne çıkan sinyaller cihazına düşer.",
    metrics: [
      { label: "Seanslar", value: "3 saat / 1 saat", hint: "Ders öncesi", icon: "calendar" },
      { label: "Danışan akışı", value: "Canlı", hint: "Atama ve değişiklik", icon: "members" },
    ],
  },
  MEMBER: {
    title: "Randevularını ve hedeflerini kaçırma",
    subtitle: "Ders saatleri, paket bitişleri ve ölçüm hatırlatmaları tek yerden aksın.",
    primaryCopy: "Üye olarak yaklaşan derslerini, paket yenileme zamanını ve ölçüm düzenini bildirimlerle daha rahat takip edebilirsin.",
    secondaryCopy: "İzin verirsen rezervasyon hatırlatmaları, kampanya fırsatları ve gelişim özetleri doğrudan cihazına gelir.",
    metrics: [
      { label: "Hatırlatma", value: "3 saat / 1 saat", hint: "Ders öncesi", icon: "calendar" },
      { label: "Süreklilik", value: "Paket / ölçüm", hint: "Takipte kal", icon: "package" },
    ],
  },
};

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const {
    user,
    onboardingState,
    notificationPermissionStatus,
    dismissNotificationPermissionPrompt,
    requestNotificationPermission,
  } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const content = useMemo(() => {
    if (!user) {
      return CONTENT_BY_ROLE.MEMBER;
    }
    return CONTENT_BY_ROLE[user.role];
  }, [user]);

  function continueToNextScreen() {
    if (!user) {
      router.replace("/(auth)/welcome" as never);
      return;
    }

    router.replace(resolveRoleHome(user.role, onboardingState, user) as never);
  }

  async function handleAllow() {
    try {
      setLoading(true);
      setError("");
      const status = await requestNotificationPermission();
      if (status === "denied") {
        setError("Bildirim izni kapalı görünüyor. İstersen daha sonra cihaz ayarlarından açabilirsin.");
      }
      continueToNextScreen();
    } catch {
      setError("Bildirim izni şu anda alınamadı. Şimdilik devam edip daha sonra tekrar deneyebilirsin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await dismissNotificationPermissionPrompt();
    continueToNextScreen();
  }

  return (
    <MarketingShell
      title={content.title}
      subtitle={content.subtitle}
      icon="notifications"
      footer={
        <View style={styles.footer}>
          <ActionButton label="İzin ver ve devam et" icon="notifications" onPress={handleAllow} loading={loading} />
          <ActionButton label="Şimdilik atla" icon="spark" variant="ghost" onPress={() => void handleSkip()} />
        </View>
      }
    >
      <View style={styles.metricsRow}>
        {content.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} icon={metric.icon} />
        ))}
      </View>
      <SurfaceCard>
        <Text style={styles.copy}>{content.primaryCopy}</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.copy}>{content.secondaryCopy}</Text>
        <Text style={styles.caption}>
          {notificationPermissionStatus === "denied"
            ? "Bildirimler şu anda kapalı. Bu tercihi daha sonra cihaz ayarlarından veya uygulama içi bildirim tercihleri alanından güncelleyebilirsin."
            : "İzin vermesen de uygulamayı kullanmaya devam edebilirsin. Sadece zaman kritik hatırlatmalar cihazına düşmez."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SurfaceCard>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  footer: {
    gap: tokens.spacing.sm,
  },
  copy: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  caption: {
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
