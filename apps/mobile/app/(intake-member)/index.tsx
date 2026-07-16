import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { safeBack } from "@/lib/navigation";
import { useAppFlow } from "@/providers/app-flow";
import { OnboardingQuestionStage, type OnboardingOption } from "@/theme/components/onboarding-question-stage";
import type { AppIconName } from "@/theme/components/app-icon";
import { getPendingSalonJoinIntent } from "@/lib/local-preferences";
import { resolveMemberSalonConnection } from "@/lib/salon-discovery";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type MemberQuestion = {
  key: "goal" | "expectation" | "weeklyDays" | "timePreference";
  icon: AppIconName;
  eyebrow: string;
  title: string;
  subtitle: string;
  helperText: string;
  badgeLabel: string;
  options: OnboardingOption[];
};

const QUESTIONS: MemberQuestion[] = [
  {
    key: "goal",
    icon: "spark",
    eyebrow: "Hizmet tercihi",
    title: "Nasıl bir hizmeti incelemek istersin?",
    subtitle: "Klinik bağlantın olmadığı için yalnızca keşif tercihini soruyoruz; belirti, tanı veya sağlık geçmişi istemiyoruz.",
    helperText: "Bu geçici seçim yalnızca yayınlanmış klinik ve paketleri sıralamak için kullanılır.",
    badgeLabel: "Minimum veri",
    options: [
      { value: "Birebir ders", label: "Birebir ders", description: "Tek uzmanla kişisel bir ders düzenini incelemek istiyorum.", icon: "member" },
      { value: "Grup dersi", label: "Grup dersi", description: "Küçük veya düzenli grup seçeneklerini karşılaştırmak istiyorum.", icon: "members" },
      { value: "Klinik pilates / reformer", label: "Klinik pilates / reformer", description: "Klinik ve stüdyoların pilates seçeneklerini görmek istiyorum.", icon: "spark" },
      { value: "Genel hareket programı", label: "Genel hareket programı", description: "Düzenli bir hareket rutini için sunulan paketleri incelemek istiyorum.", icon: "calendar" },
      { value: "Henüz karar vermedim", label: "Henüz karar vermedim", description: "Önce klinikleri ve sundukları hizmetleri görmek istiyorum.", icon: "salon" },
    ],
  },
  {
    key: "expectation",
    icon: "salon",
    eyebrow: "Salon beklentisi",
    title: "Salon seçerken en çok neye bakarsın?",
    subtitle: "İlk listede yakın salonları öne alıp kalite, ortam ve ders tipiyle karşılaştırmanı sağlayacağız.",
    helperText: "Bu seçim keşif ekranındaki öncelik dilini belirler.",
    badgeLabel: "Tercih sinyali",
    options: [
      { value: "Yakın olsun", label: "Yakın olsun", description: "Ulaşımı kolay salonlar benim için daha güçlü aday.", icon: "location" },
      { value: "Uygun fiyatlı olsun", label: "Uygun fiyatlı olsun", description: "Bütçeme daha yakın seçenekleri önce görmek istiyorum.", icon: "wallet" },
      { value: "Eğitmen kalitesi önemli", label: "Eğitmen kalitesi önemli", description: "Deneyimli ve güven veren eğitmen yapısı benim için kritik.", icon: "trainer" },
      { value: "Sessiz / butik ortam", label: "Sessiz / butik ortam", description: "Daha sakin, daha odaklı ve butik bir atmosfer arıyorum.", icon: "salon" },
      { value: "Grup dersi", label: "Grup dersi", description: "Birlikte motive olabileceğim ders yapıları ilgimi çekiyor.", icon: "members" },
      { value: "Birebir ilgi", label: "Birebir ilgi", description: "Daha kişisel ve yakın takip sunan deneyim benim için daha uygun.", icon: "member" },
    ],
  },
  {
    key: "weeklyDays",
    icon: "calendar",
    eyebrow: "Ritim",
    title: "Haftada kaç gün ayırabilirsin?",
    subtitle: "Paket ve saat önerilerini günlük tempona göre şekillendireceğiz.",
    helperText: "İleride göreceğin paket ve ders akışı bu ritme göre sadeleşir.",
    badgeLabel: "Program uyumu",
    options: [
      { value: "1 gün", label: "1 gün", description: "Yavaş ve sürdürülebilir bir başlangıç benim için daha uygun.", icon: "calendar" },
      { value: "2 gün", label: "2 gün", description: "Dengeli ama zorlamayan bir düzen hedefliyorum.", icon: "calendar" },
      { value: "3 gün", label: "3 gün", description: "Daha belirgin bir rutin kurmak istiyorum.", icon: "calendar" },
      { value: "4+ gün", label: "4+ gün", description: "Daha sık ve disiplinli ilerlemeye hazırım.", icon: "calendar" },
    ],
  },
  {
    key: "timePreference",
    icon: "clock",
    eyebrow: "Saat tercihi",
    title: "Tercih ettiğin saat aralığı nedir?",
    subtitle: "Bir sonraki adımda konum izniyle yakın salonları öne alacağız; diğer salonlar da listede kalacak.",
    helperText: "Son seçimden sonra konum ve salon keşif aşamasına geçeceğiz.",
    badgeLabel: "Son adım",
    options: [
      { value: "Sabah", label: "Sabah", description: "Güne erken başlamak ve daha sakin saatleri değerlendirmek istiyorum.", icon: "clock" },
      { value: "Öğlen", label: "Öğlen", description: "Günün ortasında bana uyan seçenekleri görmek istiyorum.", icon: "clock" },
      { value: "Akşam", label: "Akşam", description: "İş veya günlük plan sonrası daha uygun saatleri tercih ederim.", icon: "clock" },
    ],
  },
];

export default function IntakeQuestionFlowScreen() {
  const router = useRouter();
  const { memberIntent, setMemberIntent } = useAppFlow();
  const [step, setStep] = useState(0);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [showDiscoveryQuestions, setShowDiscoveryQuestions] = useState(false);
  const isAdvancing = useRef(false);
  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const activeValue = memberIntent[current.key];

  useEffect(() => {
    let mounted = true;
    void getPendingSalonJoinIntent().then((pendingIntent) => {
      if (!mounted) return;
      const connection = resolveMemberSalonConnection(pendingIntent?.slug);
      if (connection.kind === "CONNECTED_LINK") {
        router.replace(connection.route as never);
        return;
      }
      setConnectionChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!connectionChecked) {
    return <View style={styles.loadingScreen} />;
  }

  if (!showDiscoveryQuestions) {
    return (
      <MarketingShell
        title="Kliniğine bağlan"
        subtitle="FizyoFlow üye deneyimi kliniğinin QR kodu, daveti veya salon bağlantısıyla başlar."
        icon="scan"
        footer={
          <View style={styles.footer}>
            <ActionButton
              testID="member-connect-scan-qr"
              label="Salon QR kodunu okut"
              icon="scan"
              onPress={() => router.push("/(auth)/scan-salon-qr" as never)}
            />
            <ActionButton
              testID="member-connect-invite"
              label="Davet koduyla bağlan"
              icon="trainer"
              variant="ghost"
              onPress={() => router.push("/(auth)/invite-accept" as never)}
            />
            <ActionButton
              testID="member-connect-discovery"
              label="Klinikleri incele"
              icon="salon"
              variant="ghost"
              onPress={() => {
                setMemberIntent({ ...memberIntent, goal: "", issue: "" });
                setShowDiscoveryQuestions(true);
              }}
            />
          </View>
        }
      >
        <View style={styles.connectionIntro}>
          <ConnectionItem
            icon="qr"
            title="Kliniğinden QR iste"
            description="Resepsiyondaki veya kliniğinin gönderdiği FizyoFlow QR kodu seni doğrudan doğru kayıt akışına götürür."
          />
          <ConnectionItem
            icon="trainer"
            title="Davet veya salon linkini aç"
            description="Kliniğinin mesajla gönderdiği bağlantı ve davet kodu da aynı salon bağlamını güvenle korur."
          />
          <Text style={styles.discoveryNote}>Henüz bir kliniğin yoksa yayınlanmış klinikleri ikincil keşif adımından inceleyebilirsin.</Text>
          <Text style={styles.dataPurposeNote}>
            Keşif sırasında sağlık geçmişi, tanı veya belirti istemeyiz. Ayrıntılı sağlık bilgileri ancak bir kliniğe bağlandıktan sonra, ilgili hizmet için gerekli olduğu ölçüde ve ayrıca bilgilendirilerek alınabilir.
          </Text>
        </View>
      </MarketingShell>
    );
  }

  function moveNext() {
    if (isLast) {
      router.push("/(intake-member)/location-permission" as never);
      return;
    }
    setStep((value) => value + 1);
  }

  function handleSelect(value: string) {
    if (isAdvancing.current) return;
    isAdvancing.current = true;
    setMemberIntent({ ...memberIntent, [current.key]: value });
    setTimeout(() => {
      moveNext();
      isAdvancing.current = false;
    }, 150);
  }

  function handleBack() {
    if (step === 0) {
      safeBack(router, "/(auth)/welcome");
      return;
    }
    setStep((value) => value - 1);
  }

  return (
    <OnboardingQuestionStage
      step={step + 1}
      total={QUESTIONS.length}
      icon={current.icon}
      eyebrow={current.eyebrow}
      title={current.title}
      subtitle={current.subtitle}
      helperText={current.helperText}
      badgeLabel={current.badgeLabel}
      options={current.options}
      activeValue={activeValue}
      onSelect={handleSelect}
      onBack={handleBack}
      animationKey={`${current.key}-${step}`}
      backTestId="member-intake-back"
      optionTestIdPrefix={`member-intake-${current.key}`}
    />
  );
}

function ConnectionItem({ icon, title, description }: { icon: "qr" | "trainer"; title: string; description: string }) {
  return (
    <View style={styles.connectionItem}>
      <View style={styles.connectionIcon}>
        <AppIcon name={icon} size="sm" tone="primary" />
      </View>
      <View style={styles.connectionCopy}>
        <Text style={styles.connectionTitle}>{title}</Text>
        <Text style={styles.connectionDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: tokens.colors.background },
  footer: { gap: tokens.spacing.sm },
  connectionIntro: { gap: tokens.spacing.md },
  connectionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionCopy: { flex: 1, gap: tokens.spacing.xs },
  connectionTitle: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  connectionDescription: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  discoveryNote: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, lineHeight: 18, fontFamily: tokens.fontFamily.medium },
  dataPurposeNote: { color: tokens.colors.text, fontSize: tokens.font.xs, lineHeight: 18, fontFamily: tokens.fontFamily.regular },
});
