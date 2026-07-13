import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { safeBack } from "@/lib/navigation";
import { SIGNUP_QUESTION_SET } from "@/lib/signup-onboarding";
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
  const [stepIndex, setStepIndex] = useState(0);
  const isAdvancing = useRef(false);
  const persona = selectedPersoma ?? "ADMIN";

  useEffect(() => {
    if (!selectedPersoma) setSelectedPersoma("ADMIN");
  }, [selectedPersoma, setSelectedPersoma]);

  const steps = [
    {
      key: "persona" as const,
      icon: "spark" as const,
      eyebrow: "Rol seçimi",
      badgeLabel: "Başlangıç",
      title: "Kliniğini kur veya davetinle katıl",
      subtitle: "Normal kayıt klinik sahibi hesabı oluşturur. Ekip ve danışan hesapları klinik bağlantısıyla başlar.",
      helperText: "Klinik sahibi olarak devam edebilir; davet kodun veya salon QR’ın varsa ilgili yolu seçebilirsin.",
      options: PERSONA_OPTIONS,
    },
    ...SIGNUP_QUESTION_SET[persona].map((item, index) => ({
      key: item.key,
      icon: item.options[0]?.icon || "spark",
      eyebrow: item.eyebrow,
      badgeLabel: index === SIGNUP_QUESTION_SET[persona].length - 1 ? "Son adım" : "Profil ayarı",
      title: item.title,
      subtitle: item.subtitle,
      helperText: "Seçimin kaydedilir ve akış otomatik olarak sonraki adıma ilerler.",
      options: item.options,
    })),
  ];

  const currentStep = steps[stepIndex];
  const activeValue = currentStep.key === "persona" ? selectedPersoma ?? "" : signupOnboarding[currentStep.key];

  async function finishFlow(nextProfile = signupOnboarding) {
    await setStoredSignupOnboardingProfile("ADMIN", nextProfile);
    await setSignupOnboardingRole("ADMIN");
    await setSignupOnboardingCompleted(true);
    advanceSignupFlow();
    router.replace("/(auth)/owner-plan" as never);
  }

  function moveNext(nextProfile = signupOnboarding) {
    if (stepIndex === steps.length - 1) {
      void finishFlow(nextProfile);
      return;
    }
    setStepIndex((prev) => prev + 1);
  }

  function handleSelect(value: string) {
    if (isAdvancing.current) return;
    isAdvancing.current = true;

    if (currentStep.key === "persona") {
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
      setTimeout(() => {
        moveNext(resetProfile);
        isAdvancing.current = false;
      }, 150);
      return;
    }

    const nextProfile = {
      ...signupOnboarding,
      [currentStep.key]: value,
    };
    setSignupOnboarding(nextProfile);
    setTimeout(() => {
      moveNext(nextProfile);
      isAdvancing.current = false;
    }, 150);
  }

  function handleBack() {
    if (stepIndex === 0) {
      safeBack(router, "/(auth)/welcome");
      return;
    }
    setStepIndex((prev) => prev - 1);
    isAdvancing.current = false;
  }

  return (
    <OnboardingQuestionStage
      step={stepIndex + 1}
      total={steps.length}
      icon={currentStep.icon}
      eyebrow={currentStep.eyebrow}
      title={currentStep.title}
      subtitle={currentStep.subtitle}
      helperText={currentStep.helperText}
      badgeLabel={currentStep.badgeLabel}
      options={currentStep.options}
      activeValue={activeValue}
      onSelect={handleSelect}
      onBack={handleBack}
      animationKey={`${persona}-${String(currentStep.key)}-${stepIndex}`}
      backTestId="role-assessment-back"
      optionTestIdPrefix={currentStep.key === "persona" ? "role-option" : `role-step-${String(currentStep.key).toLowerCase()}`}
    />
  );
}
