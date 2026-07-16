import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { safeBack } from "@/lib/navigation";
import { setSignupOnboardingCompleted, setSignupOnboardingRole, setStoredSignupOnboardingProfile } from "@/lib/local-preferences";
import { useAppFlow, type AppPersoma } from "@/providers/app-flow";
import { OnboardingQuestionStage, type OnboardingOption } from "@/theme/components/onboarding-question-stage";

const PERSONA_OPTIONS: Array<OnboardingOption & { persona: AppPersoma }> = [
  {
    persona: "ADMIN",
    value: "ADMIN",
    label: "Klinik veya salon sahibi",
    description: "Kliniğimi kurmak; operasyonu, ekibi ve danışan süreçlerini yönetmek istiyorum.",
    icon: "clinic",
  },
  {
    persona: "TRAINER",
    value: "TRAINER",
    label: "Bir kliniğe davet edildim",
    description: "Fizyoterapist veya eğitmen olarak klinik yöneticimin davet koduyla katılacağım.",
    icon: "trainer",
  },
  {
    persona: "MEMBER",
    value: "MEMBER",
    label: "Salon QR ile katılacağım",
    description: "Danışan veya üye olarak salonun QR kodu ya da bağlantısıyla devam edeceğim.",
    icon: "member",
  },
];

export default function RoleAssessmentScreen() {
  const router = useRouter();
  const { advanceSignupFlow, resetSignupFlow, selectedPersoma, setSelectedPersoma, signupOnboarding, setSignupOnboarding } = useAppFlow();
  const isAdvancing = useRef(false);

  useEffect(() => {
    if (!selectedPersoma) setSelectedPersoma("ADMIN");
  }, [selectedPersoma, setSelectedPersoma]);

  async function finishAdminFlow(nextProfile = signupOnboarding) {
    await setStoredSignupOnboardingProfile("ADMIN", nextProfile);
    await setSignupOnboardingRole("ADMIN");
    await setSignupOnboardingCompleted(true);
    advanceSignupFlow();
    router.replace("/(auth)/register" as never);
  }

  function handleSelect(value: string) {
    if (isAdvancing.current) return;
    isAdvancing.current = true;

    const nextPersona = value as AppPersoma;
    const resetProfile = { primaryGoal: "", rhythm: "", supportStyle: "" };

    if (nextPersona === "TRAINER") {
      resetSignupFlow();
      router.replace("/(auth)/trainer-invite-guide" as never);
      isAdvancing.current = false;
      return;
    }

    if (nextPersona === "MEMBER") {
      resetSignupFlow();
      router.replace("/(auth)/scan-salon-qr" as never);
      isAdvancing.current = false;
      return;
    }

    setSelectedPersoma(nextPersona);
    setSignupOnboarding(resetProfile);
    void finishAdminFlow(resetProfile).finally(() => {
      isAdvancing.current = false;
    });
  }

  function handleBack() {
    safeBack(router, "/(auth)/welcome");
    isAdvancing.current = false;
  }

  return (
    <OnboardingQuestionStage
      step={1}
      total={1}
      icon="spark"
      eyebrow="Başlangıç"
      title="Kliniğini kur veya davetinle katıl"
      subtitle="Klinik sahibi hesabı doğrudan dört adımlı kuruluma geçer. Ekip ve danışan hesapları klinik bağlantısıyla başlar."
      helperText="Klinik sahibi olarak devam edebilir; davet kodun veya salon QR’ın varsa ilgili yolu seçebilirsin."
      badgeLabel="Tek seçim"
      options={PERSONA_OPTIONS}
      activeValue={selectedPersoma ?? ""}
      onSelect={handleSelect}
      onBack={handleBack}
      animationKey="role-entry"
      backTestId="role-assessment-back"
      optionTestIdPrefix="role-option"
    />
  );
}
