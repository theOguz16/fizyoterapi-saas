import type { AppIconName } from "@/theme/components/app-icon";

export type SignupOnboardingRole = "MEMBER" | "TRAINER" | "ADMIN";

export type SignupOnboardingProfile = {
  primaryGoal: string;
  rhythm: string;
  supportStyle: string;
};

export type SignupOnboardingOption = {
  value: string;
  label: string;
  description: string;
  icon: AppIconName;
};

export type SignupQuestionStep = {
  key: keyof SignupOnboardingProfile;
  eyebrow: string;
  title: string;
  subtitle: string;
  options: SignupOnboardingOption[];
};

export type SignupOnboardingSummary = {
  title: string;
  subtitle: string;
  pillars: Array<{
    label: string;
    value: string;
    description: string;
    icon: AppIconName;
  }>;
  recommendation: string;
};

const MEMBER_QUESTIONS: SignupQuestionStep[] = [
  {
    key: "primaryGoal",
    eyebrow: "Hedef",
    title: "Başlangıçta en çok hangi hedefe odaklanıyorsun?",
    subtitle: "Sana uygun üyelik akışını hazırlamak için önceliğini seç.",
    options: [
      { value: "fitness", label: "Düzenli spor alışkanlığı", description: "Programımı netleştirip sürdürülebilir bir rutin oluşturmak istiyorum.", icon: "calendar" },
      { value: "body", label: "Form ve görünüm", description: "Ders planı ve ölçüm takibiyle daha görünür sonuç almak istiyorum.", icon: "measurements" },
      { value: "recovery", label: "Kendimi daha iyi hissetmek", description: "Bedenime uygun bir tempoyla güvenli ve dengeli şekilde ilerlemek istiyorum.", icon: "spark" },
    ],
  },
  {
    key: "rhythm",
    eyebrow: "Tempo",
    title: "Haftalık tempon hangisine daha yakın?",
    subtitle: "Salon, paket ve planlama önerileri bu seçime göre şekillenir.",
    options: [
      { value: "light", label: "Haftada 1-2 gün", description: "Yoğun gündemime uygun, sürdürülebilir bir planla ilerlemek istiyorum.", icon: "clock" },
      { value: "steady", label: "Haftada 3-4 gün", description: "Düzenli bir akış kurup takvimimi daha planlı yönetmek istiyorum.", icon: "calendar" },
      { value: "intense", label: "Haftada 5 gün ve üzeri", description: "Daha sık ders alıp disiplinli bir programla ilerlemek istiyorum.", icon: "target" },
    ],
  },
  {
    key: "supportStyle",
    eyebrow: "Deneyim",
    title: "Başlangıçta nasıl bir deneyim beklersin?",
    subtitle: "İlk kullanım akışında sana nasıl eşlik edeceğimizi seç.",
    options: [
      { value: "guided", label: "Adım adım yönlendirme", description: "Salon, paket ve rezervasyon seçimlerinde net öneriler görmek istiyorum.", icon: "spark" },
      { value: "balanced", label: "Hızlı ama kontrollü", description: "Kararları ben vereyim; önemli adımlarda kısa yönlendirme alayım.", icon: "progress" },
      { value: "self-serve", label: "Doğrudan seçim yapmak", description: "Seçenekleri net göreyim, kararımı hızlıca kendim vereyim.", icon: "arrow-right" },
    ],
  },
];

const TRAINER_QUESTIONS: SignupQuestionStep[] = [
  {
    key: "primaryGoal",
    eyebrow: "Odak",
    title: "Uygulamada önce hangi alanı düzenli hale getirmek istiyorsun?",
    subtitle: "Eğitmen deneyimini çalışma biçimine göre sadeleştireceğiz.",
    options: [
      { value: "schedule", label: "Ders programı", description: "Takvim, değişiklik yönetimi ve check-in akışı benim için öncelikli.", icon: "calendar" },
      { value: "clients", label: "Danışan takibi", description: "Üye geçmişi, notlar ve günlük takip ekranları benim için daha önemli.", icon: "members" },
      { value: "income", label: "Kazanç görünürlüğü", description: "Seanslarımı ve gelir özetimi daha net görmek istiyorum.", icon: "earnings" },
    ],
  },
  {
    key: "rhythm",
    eyebrow: "Çalışma şekli",
    title: "Çalışma düzenin çoğunlukla nasıl ilerliyor?",
    subtitle: "Takvim ve günlük operasyon ekranları bu seçime göre şekillenir.",
    options: [
      { value: "fixed", label: "Sabit saatlerle", description: "Derslerim çoğunlukla planlı, düzenli ve tekrar eden bloklardan oluşuyor.", icon: "clock" },
      { value: "mixed", label: "Karma program", description: "Hem sabit hem esnek rezervasyonlarla çalışan bir program yönetiyorum.", icon: "calendar" },
      { value: "dynamic", label: "Sık değişen akış", description: "İptal, ek ders ve anlık değişiklikler gün içinde sık yaşanıyor.", icon: "notifications" },
    ],
  },
  {
    key: "supportStyle",
    eyebrow: "Operasyon",
    title: "Uygulama sana en çok hangi konuda destek olmalı?",
    subtitle: "İlk kullanım deneyimini iş yüküne göre daha uygun hale getireceğiz.",
    options: [
      { value: "clarity", label: "Net görünürlük", description: "Bugün, danışan ve not ekranlarının daha okunaklı olmasını istiyorum.", icon: "progress" },
      { value: "speed", label: "Hızlı aksiyon", description: "Check-in, takvim ve danışan detayına daha az adımla ulaşmak istiyorum.", icon: "scan" },
      { value: "balance", label: "Dengeli kullanım", description: "Hem görünürlük hem de hız benim için aynı derecede önemli.", icon: "spark" },
    ],
  },
];

const ADMIN_QUESTIONS: SignupQuestionStep[] = [
  {
    key: "primaryGoal",
    eyebrow: "Öncelik",
    title: "İlk günden hangi alanı daha sıkı yönetmek istiyorsun?",
    subtitle: "Klinik yönetimi deneyimini bu önceliğe göre daha doğru başlatacağız.",
    options: [
      { value: "operations", label: "Günlük operasyon", description: "Onaylar, giriş akışı ve yoğun saat yönetimi benim için en kritik alan.", icon: "approvals" },
      { value: "growth", label: "Büyüme ve kampanyalar", description: "Danışan kazanımı, paket yenileme ve kampanya görünürlüğü önceliğim.", icon: "campaigns" },
      { value: "team", label: "Ekip ve klinik düzeni", description: "Ekip yapısı, çalışma saatleri ve klinik düzeni önce oturmalı.", icon: "clinic" },
    ],
  },
  {
    key: "rhythm",
    eyebrow: "Tempo",
    title: "Klinik yönetiminde günlerin çoğunlukla nasıl geçiyor?",
    subtitle: "Panelde öne çıkan özetler ve ilk ekran yoğunluğu buna göre şekillenir.",
    options: [
      { value: "steady", label: "Planlı ve düzenli", description: "Süreçler büyük ölçüde oturmuş durumda; daha çok görünürlük ve takip istiyorum.", icon: "calendar" },
      { value: "busy", label: "Yoğun ama yönetilebilir", description: "Birçok işi aynı anda yönetiyorum; net özetler benim için önemli.", icon: "notifications" },
      { value: "critical", label: "Anlık karar yoğun", description: "Operasyon sık değişiyor; hızlı müdahale edebileceğim bir yapı istiyorum.", icon: "risk" },
    ],
  },
  {
    key: "supportStyle",
    eyebrow: "Yönetim stili",
    title: "Panel kullanımında nasıl bir yapı beklersin?",
    subtitle: "İlk kullanım deneyiminde hangi değeri daha görünür vereceğimizi seç.",
    options: [
      { value: "control", label: "Tam görünürlük", description: "Kliniğin kritik verilerini ilk bakışta net biçimde görmek istiyorum.", icon: "dashboard" },
      { value: "action", label: "Hızlı müdahale", description: "Önemli uyarıları görüp gerekli aksiyonu hızlıca almak istiyorum.", icon: "spark" },
      { value: "balance", label: "Dengeli yapı", description: "Özetler net olsun, işlem yapmak da mümkün olduğunca hızlı olsun.", icon: "progress" },
    ],
  },
];

export const SIGNUP_QUESTION_SET: Record<SignupOnboardingRole, SignupQuestionStep[]> = {
  MEMBER: MEMBER_QUESTIONS,
  TRAINER: TRAINER_QUESTIONS,
  ADMIN: ADMIN_QUESTIONS,
};

function findOption(role: SignupOnboardingRole, key: keyof SignupOnboardingProfile, value?: string | null) {
  const step = SIGNUP_QUESTION_SET[role].find((item) => item.key === key);
  return step?.options.find((option) => option.value === value) || step?.options[0];
}

export function summarizeSignupOnboarding(role: SignupOnboardingRole, profile: SignupOnboardingProfile): SignupOnboardingSummary {
  const goal = findOption(role, "primaryGoal", profile.primaryGoal);
  const rhythm = findOption(role, "rhythm", profile.rhythm);
  const support = findOption(role, "supportStyle", profile.supportStyle);

  const titleMap: Record<SignupOnboardingRole, string> = {
    MEMBER: "Danışan özeti",
    TRAINER: "Ekip üyesi özeti",
    ADMIN: "Klinik sahibi özeti",
  };

  const subtitleMap: Record<SignupOnboardingRole, string> = {
    MEMBER: "Bağlı olduğun klinikteki seans, paket ve başlangıç yönlendirmesi bu profile göre hazırlandı.",
    TRAINER: "Klinik ekibindeki takvim, danışan ve günlük operasyon öncelikleri bu profile göre düzenlendi.",
    ADMIN: "Klinik kurulumu, plan kararı ve operasyon başlangıcı bu profile göre kurgulandı.",
  };

  const recommendationMap: Record<SignupOnboardingRole, string> = {
    MEMBER: `${goal?.label || "Başlangıç hedefi"} odağıyla ${rhythm?.label?.toLocaleLowerCase("tr-TR") || "düzenli"} bir ritim hedefleniyor. İlk haftalarda ${support?.label?.toLocaleLowerCase("tr-TR") || "dengeli"} deneyim daha uygun görünüyor.`,
    TRAINER: `${goal?.label || "Takvim odaklı"} başlangıç için ${rhythm?.label?.toLocaleLowerCase("tr-TR") || "karışık"} tempoya uygun, ${support?.label?.toLocaleLowerCase("tr-TR") || "dengeli"} bir operasyon dili öneriliyor.`,
    ADMIN: `${goal?.label || "Operasyon"} odağında, ${rhythm?.label?.toLocaleLowerCase("tr-TR") || "yoğun"} iş temposuna uygun ${support?.label?.toLocaleLowerCase("tr-TR") || "denge"} yaklaşımı seçildi. Planlama ve deneme kurgusu buna göre ilerleyebilir.`,
  };

  return {
    title: titleMap[role],
    subtitle: subtitleMap[role],
    pillars: [
      {
        label: "Ana odak",
        value: goal?.label || "-",
        description: goal?.description || "",
        icon: goal?.icon || "spark",
      },
      {
        label: "Ritim",
        value: rhythm?.label || "-",
        description: rhythm?.description || "",
        icon: rhythm?.icon || "calendar",
      },
      {
        label: "Destek tarzı",
        value: support?.label || "-",
        description: support?.description || "",
        icon: support?.icon || "progress",
      },
    ],
    recommendation: recommendationMap[role],
  };
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function createSyntheticSignupOnboarding(role: SignupOnboardingRole, seed: string): SignupOnboardingProfile {
  const source = SIGNUP_QUESTION_SET[role];
  const base = hashSeed(`${role}:${seed}`);
  return {
    primaryGoal: source[0].options[base % source[0].options.length]?.value || source[0].options[0].value,
    rhythm: source[1].options[(base + 1) % source[1].options.length]?.value || source[1].options[0].value,
    supportStyle: source[2].options[(base + 2) % source[2].options.length]?.value || source[2].options[0].value,
  };
}

export function getDefaultSignupProfile(role: SignupOnboardingRole) {
  return createSyntheticSignupOnboarding(role, role);
}

export function mapSignupProfileToMemberIntentDefaults(profile: SignupOnboardingProfile) {
  const goalMap: Record<string, string> = {
    fitness: "Düzenli egzersiz alışkanlığı kazanmak istiyorum",
    body: "Kilo / yağ / kas takibi istiyorum",
    recovery: "Daha sağlıklı hissetmek istiyorum",
  };
  const issueMap: Record<string, string> = {
    fitness: "Hareketsizlik",
    body: "Kilo kontrolü",
    recovery: "Stres / gerginlik",
  };
  const rhythmMap: Record<string, string> = {
    light: "2 gün",
    steady: "3 gün",
    intense: "4+ gün",
  };
  const expectationMap: Record<string, string> = {
    guided: "Birebir ilgi",
    balanced: "Eğitmen kalitesi önemli",
    "self-serve": "Uygun fiyatlı olsun",
  };

  return {
    goal: goalMap[profile.primaryGoal] || "",
    issue: issueMap[profile.primaryGoal] || "",
    expectation: expectationMap[profile.supportStyle] || "",
    weeklyDays: rhythmMap[profile.rhythm] || "",
  };
}
