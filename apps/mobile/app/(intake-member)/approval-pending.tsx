import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { resolveSelectedPackages } from "@/lib/member-package-queue";
import { useSession } from "@/providers/auth-session";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { paymentStatusLabel, statusLabel } from "@/lib/labels";

export default function ApprovalPendingScreen() {
  const router = useRouter();
  const { pendingApplication, pendingPaymentRequest } = useSession();
  const { memberIntent, memberBookingDraft } = useAppFlow();
  const selectedPackages = resolveSelectedPackages(memberBookingDraft);
  const submittedPackageIds = new Set(memberBookingDraft.submittedPackageIds || []);
  const submittedPackages = selectedPackages.filter((pkg) => submittedPackageIds.has(pkg.package_id));
  const remainingPackages = selectedPackages.filter((pkg) => !submittedPackageIds.has(pkg.package_id));
  const packageProgressLabel =
    selectedPackages.length > 1 ? `${submittedPackages.length} / ${selectedPackages.length} paket gönderildi` : "Paket onaya gönderildi";

  return (
    <AppShell title="Başvurun alındı" subtitle="Salon ekibi seçimlerini inceliyor. Durum değiştiğinde sana haber vereceğiz." icon="approvals">
      <AnimatedEntrance>
        <IntakeProgressCard
          step={6}
          total={6}
          icon="approvals"
          eyebrow="Onay süreci"
          title="Başvurun incelemeye alındı"
          description="Salon ekibi paket, eğitmen ve saat uygunluğunu birlikte değerlendirerek başvurunu sonuçlandıracak."
          badgeLabel="İnceleniyor"
          badgeTone="warning"
          summaryItems={[
            { label: "Salon", value: memberBookingDraft.salonName || "-" },
            { label: "Durum", value: packageProgressLabel },
            { label: "Son paket", value: submittedPackages[submittedPackages.length - 1]?.package_title || memberBookingDraft.packageTitle || "-" },
          ]}
          footnote={
            remainingPackages.length > 0
              ? "Bazı paketler hâlâ sırada görünüyor. Onaya gönderilen seçimler kayıtlı kaldı; kalanlar için akışa dönebilirsin."
              : "Şimdilik ek bir işlem yapmana gerek yok. Onay veya ödeme adımı netleştiğinde seni yönlendireceğiz."
          }
        />
      </AnimatedEntrance>

      <AnimatedEntrance delay={70} style={styles.metricsRow}>
        <MetricCard
        label="Başvuru"
        value={
          pendingApplication?.status === "PENDING"
            ? "İncelemede"
            : statusLabel(pendingApplication?.status) || "İncelemede"
        }
        hint="Salon değerlendirmesi"
        icon="approvals"
      />
       <MetricCard
        label="Ödeme"
        value={
          pendingPaymentRequest?.status === "PENDING" ||
          pendingApplication?.payment_status === "PENDING"
            ? "Beklemede"
            : paymentStatusLabel(
                pendingPaymentRequest?.status || pendingApplication?.payment_status
              ) || "Beklemede"
        }
        hint="İşlem durumu"
        icon="wallet"
      />
        <MetricCard label="Paket ilerleme" value={selectedPackages.length > 1 ? `${submittedPackages.length}/${selectedPackages.length}` : "1/1"} hint="Gönderilen paket" icon="package" />
      </AnimatedEntrance>

      <AnimatedEntrance delay={130}>
        <SurfaceCard tone="warning">
          <StatusBadge label="İnceleniyor" tone="warning" />
          <View style={styles.infoRow}>
            <AppIcon name="calendar" size="sm" tone="warning" />
            <Text style={styles.copy}>Başvurun sıraya alındı. Seçtiğin saatler inceleme sürecinde kayıtlı kalır.</Text>
          </View>
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={190}>
        <SurfaceCard>
          <Text style={styles.section}>Paket durumu</Text>
          {submittedPackages.map((pkg) => (
            <Text key={pkg.package_id} style={styles.copy}>• {pkg.package_title || pkg.package_id}: onaya gönderildi</Text>
          ))}
          {remainingPackages.map((pkg) => (
            <Text key={pkg.package_id} style={styles.copy}>• {pkg.package_title || pkg.package_id}: sırada bekliyor</Text>
          ))}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={250}>
        <SurfaceCard>
          <Text style={styles.section}>Gönderdiğin bilgiler</Text>
          <Text style={styles.copy}>Hedef: {memberIntent.goal || "-"}</Text>
          <Text style={styles.copy}>Beklenti: {memberIntent.expectation || "-"}</Text>
          <Text style={styles.copy}>Gönderilen paket sayısı: {submittedPackages.length || 1}</Text>
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={310}>
        <SurfaceCard>
          <Text style={styles.section}>Gönderilen seanslar</Text>
          {submittedPackages.length === 0 ? (
            <Text style={styles.copy}>Bu başvuru için ayrıca seans bilgisi paylaşılmadı.</Text>
          ) : submittedPackages.some((pkg) => (pkg.preferred_slots || []).length > 0) ? (
            submittedPackages.map((pkg) =>
              (pkg.preferred_slots || []).map((slot) => (
                <Text key={`${pkg.package_id}-${slot.starts_at}`} style={styles.copy}>
                  • {pkg.package_title || pkg.package_id}: {slot.label}
                </Text>
              ))
            )
          ) : (
            <Text style={styles.copy}>Gönderilen paketlerde ayrı seans tercihi bulunmuyor.</Text>
          )}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={370} style={styles.actions}>
        {remainingPackages.length > 0 ? (
          <ActionButton
            label="Sıradaki pakete dön"
            icon="package"
            onPress={() =>
              router.push({
                pathname: "/(intake-member)/packages",
                params: { slug: memberBookingDraft.salonSlug || "" },
              } as never)
            }
          />
        ) : null}
        <ActionButton label="Ana sayfaya dön" icon="home" onPress={() => router.replace("/(member)/home" as never)} />
        <ActionButton
          label="Başvuruyu gözden geçir"
          icon="calendar"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/(intake-member)/booking-summary",
              params: { slug: memberBookingDraft.salonSlug || "" },
            } as never)
          }
        />
      </AnimatedEntrance>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: tokens.spacing.sm,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
});
