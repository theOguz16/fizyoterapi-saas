// Bu provider mobil uygulamada app flow ile ilgili ortak state veya servis erisimini merkezilestirir.
// Ekranlar arasi tekrar eden baglam ihtiyaci bu dosya uzerinden yonetilir.
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import type { SignupOnboardingProfile } from "@/lib/signup-onboarding";

export type AppPersona = "MEMBER" | "TRAINER" | "ADMIN";
export type AppPersoma = AppPersona;

export type MemberIntentProfile = {
  goal: string;
  issue: string;
  expectation: string;
  weeklyDays: string;
  timePreference: string;
  allowLocation: boolean;
  locationCity?: string;
  locationDistrict?: string;
  note: string;
};

export type MemberBookingDraft = {
  e2eBypassSubmit?: boolean;
  salonSlug?: string;
  salonName?: string;
  packageId?: string;
  packageIds?: string[];
  currentPackageId?: string;
  submittedPackageIds?: string[];
  selectedPackages?: Array<{
    package_id: string;
    package_title?: string;
    package_price?: string;
    total_credits?: number;
    lesson_mode?: string;
    weekly_class_hours?: number;
    required_preference_slots?: number;
    required_trainer_free_slots?: number;
    preferred_slots?: Array<{
      starts_at: string;
      ends_at: string;
      label: string;
      package_id?: string;
      package_title?: string;
    }>;
    weekly_frequency?: number;
    trainer_id?: string;
    trainer_name?: string;
    selected_sub_lesson?: string;
    duo_partner_name?: string;
    duo_partner_contact?: string;
  }>;
  lessonMode?: string;
  allowDropInBooking?: boolean;
  selectedSubLesson?: string;
  duoPartnerName?: string;
  duoPartnerContact?: string;
  packageTitle?: string;
  packagePrice?: string;
  packageSummary?: string;
  weeklyClassHours?: number;
  requiredPreferenceSlots?: number;
  requiredTrainerFreeSlots?: number;
  trainerId?: string;
  trainerName?: string;
  preferredSlots: Array<{
    starts_at: string;
    ends_at: string;
    label: string;
    package_id?: string;
    package_title?: string;
  }>;
  weeklyFrequency?: number;
  note?: string;
  groupClassFlow?: {
    selectedLessonName?: string;
    selectedGroupClassId?: string;
    notificationScope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
    requiresAdminApproval?: boolean;
  };
};

type AppFlowContextValue = {
  selectedPersona: AppPersona | null;
  setSelectedPersona: (next: AppPersona | null) => void;
  selectedPersoma: AppPersona | null;
  setSelectedPersoma: (next: AppPersona | null) => void;
  signupFlowState: "idle" | "assessment" | "post-assessment";
  startSignupFlow: () => void;
  resumeSignupFlow: () => void;
  advanceSignupFlow: () => void;
  resetSignupFlow: () => void;
  signupOnboarding: SignupOnboardingProfile;
  setSignupOnboarding: (next: SignupOnboardingProfile) => void;
  memberIntent: MemberIntentProfile;
  setMemberIntent: (next: MemberIntentProfile) => void;
  memberBookingDraft: MemberBookingDraft;
  setMemberBookingDraft: (next: MemberBookingDraft) => void;
  resetMemberFlow: () => void;
};

const DEFAULT_SIGNUP_ONBOARDING: SignupOnboardingProfile = {
  primaryGoal: "",
  rhythm: "",
  supportStyle: "",
};

const DEFAULT_MEMBER_INTENT: MemberIntentProfile = {
  goal: "",
  issue: "",
  expectation: "",
  weeklyDays: "",
  timePreference: "",
  allowLocation: false,
  locationCity: "",
  locationDistrict: "",
  note: "",
};

const DEFAULT_MEMBER_BOOKING: MemberBookingDraft = {
  preferredSlots: [],
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

// Bu provider backend oturumundan bagimsiz, tamamen UI akisina ait gecici secimleri tutar.
// Ozellikle onboarding ve satin alma akisi birden fazla ekran gezdigi icin
// form taslagi burada saklanir.
export function AppFlowProvider({ children }: { children: ReactNode }) {
  const [selectedPersona, setSelectedPersona] = useState<AppPersona | null>(null);
  const [signupFlowState, setSignupFlowState] = useState<"idle" | "assessment" | "post-assessment">("idle");
  const [signupOnboarding, setSignupOnboarding] = useState<SignupOnboardingProfile>(DEFAULT_SIGNUP_ONBOARDING);
  const [memberIntent, setMemberIntent] = useState<MemberIntentProfile>(DEFAULT_MEMBER_INTENT);
  const [memberBookingDraft, setMemberBookingDraft] = useState<MemberBookingDraft>(DEFAULT_MEMBER_BOOKING);

  const value = useMemo<AppFlowContextValue>(
    () => ({
      selectedPersona,
      setSelectedPersona,
      selectedPersoma: selectedPersona,
      setSelectedPersoma: setSelectedPersona,
      signupFlowState,
      startSignupFlow: () => setSignupFlowState("assessment"),
      resumeSignupFlow: () => setSignupFlowState("post-assessment"),
      advanceSignupFlow: () => setSignupFlowState("post-assessment"),
      resetSignupFlow: () => {
        setSignupFlowState("idle");
        setSelectedPersona(null);
        setSignupOnboarding(DEFAULT_SIGNUP_ONBOARDING);
      },
      signupOnboarding,
      setSignupOnboarding,
      memberIntent,
      setMemberIntent,
      memberBookingDraft,
      setMemberBookingDraft,
      resetMemberFlow: () => {
        // Uye alma akisi tamamlandiginda veya kullanici basa dondugunde
        // stale secimlerin yeni akisa tasinmamasi icin temizlenir.
        setSignupFlowState("idle");
        setSelectedPersona(null);
        setSignupOnboarding(DEFAULT_SIGNUP_ONBOARDING);
        setMemberIntent(DEFAULT_MEMBER_INTENT);
        setMemberBookingDraft(DEFAULT_MEMBER_BOOKING);
      },
    }),
    [selectedPersona, signupFlowState, signupOnboarding, memberIntent, memberBookingDraft]
  );

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const context = useContext(AppFlowContext);
  if (!context) {
    throw new Error("useAppFlow must be used within AppFlowProvider");
  }
  return context;
}
