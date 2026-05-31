import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { safeBack } from "@/lib/navigation";
import { SIGNUP_QUESTION_SET } from "@/lib/signup-onboarding";
import { setSignupOnboardingCompleted, setSignupOnboardingRole, setStoredSignupOnboardingProfile } from "@/lib/local-preferences";
import { useAppFlow, type AppPersoma } from "@/providers/app-flow";
import { OnboardingQuestionStage, type OnboardingOption } from "@/theme/components/onboarding-question-stage";

const PERSONA_OPTIONS: Array<OnboardingOption & { persona: AppPersoma }> = [
  {
    persona: "MEMBER",
    value: "MEMBER",
    label: "Üye",
    description: "Salon, paket ve rezervasyon akışını daha akıcı yönetmek istiyorum.",
    icon: "member",
  },
  {
    persona: "TRAINER",
    value: "TRAINER",
    label: "Eğitmen",
    description: "Derslerimi, danışanlarımı ve günlük operasyonumu tek akışta toplamak istiyorum.",
    icon: "trainer",
  },
  {
    persona: "ADMIN",
    value: "ADMIN",
    label: "Salon sahibi",
    description: "Operasyon, ekip ve büyüme ekranlarını tek merkezden görmek istiyorum.",
    icon: "clinic",
  },
];

export default function RoleAssessmentScreen() {
  const router = useRouter();
  const { advanceSignupFlow, selectedPersoma, setSelectedPersoma, signupOnboarding, setSignupOnboarding } = useAppFlow();
  const [stepIndex, setStepIndex] = useState(0);
  const isAdvancing = useRef(false);
  const persona = selectedPersoma ?? "MEMBER";

  const steps = [
    {
      key: "persona" as const,
      icon: "spark" as const,
      eyebrow: "Rol seçimi",
      badgeLabel: "Başlangıç",
      title: "FizyoFlow’yı hangi rolde kullanacaksın?",
      subtitle: "Önce kullanım tipini seçelim; sonraki sorular buna göre şekillenecek.",
      helperText: "Rol seçimi sonrası kayıt akışı, ekran öncelikleri ve öneri dili sana göre uyarlanır.",
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

  async function finishFlow(nextPersona: AppPersoma, nextProfile = signupOnboarding) {
    await setStoredSignupOnboardingProfile(nextPersona, nextProfile);
    await setSignupOnboardingRole(nextPersona);
    await setSignupOnboardingCompleted(true);
    advanceSignupFlow();

    if (nextPersona === "ADMIN") {
      router.replace("/(auth)/owner-plan" as never);
      return;
    }
    if (nextPersona === "TRAINER") {
      router.replace("/(auth)/invite-accept" as never);
      return;
    }
    router.replace({ pathname: "/(auth)/register", params: { role: nextPersona } } as never);
  }

  function moveNext(nextPersona: AppPersoma = persona, nextProfile = signupOnboarding) {
    if (stepIndex === steps.length - 1) {
      void finishFlow(nextPersona, nextProfile);
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
      setSelectedPersoma(nextPersona);
      setSignupOnboarding(resetProfile);
      setTimeout(() => {
        moveNext(nextPersona, resetProfile);
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
      moveNext(persona, nextProfile);
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
