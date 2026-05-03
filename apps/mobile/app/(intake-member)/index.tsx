import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { safeBack } from "@/lib/navigation";
import { useAppFlow } from "@/providers/app-flow";
import { OnboardingQuestionStage, type OnboardingOption } from "@/theme/components/onboarding-question-stage";
import type { AppIconName } from "@/theme/components/app-icon";

type MemberQuestion = {
  key: "goal" | "issue" | "expectation" | "weeklyDays" | "timePreference";
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
    eyebrow: "Başlangıç odağı",
    title: "Seni en iyi hangi hedef tanımlar?",
    subtitle: "Buradaki amaç sana bir şey satmak değil; doğru salonu ve ritmi daha hızlı bulmak.",
    helperText: "İlk seçimin, keşif listesindeki öncelikleri ve öneri dilini şekillendirir.",
    badgeLabel: "Keşif başlangıcı",
    options: [
      { value: "Daha sağlıklı hissetmek istiyorum", label: "Daha sağlıklı hissetmek istiyorum", description: "Enerjimi yükseltmek ve günlük hayatımda daha iyi hissetmek istiyorum.", icon: "spark" },
      { value: "Ağrılarımı azaltmak istiyorum", label: "Ağrılarımı azaltmak istiyorum", description: "Bel, boyun veya sırt hattında beni zorlayan konulara odaklanmak istiyorum.", icon: "shield" },
      { value: "Duruşumu düzeltmek istiyorum", label: "Duruşumu düzeltmek istiyorum", description: "Daha dengeli bir postür ve daha kontrollü bir beden kullanımı hedefliyorum.", icon: "ruler" },
      { value: "Kilo / yağ / kas takibi istiyorum", label: "Kilo / yağ / kas takibi istiyorum", description: "Ölçülebilir sonuçlarla ilerlemek ve değişimi net görmek istiyorum.", icon: "measurements" },
      { value: "Düzenli egzersiz alışkanlığı kazanmak istiyorum", label: "Düzenli egzersiz alışkanlığı kazanmak istiyorum", description: "Sürdürülebilir bir rutin kurup devamlılığı önceliklemek istiyorum.", icon: "calendar" },
    ],
  },
  {
    key: "issue",
    icon: "shield",
    eyebrow: "Zorluk alanı",
    title: "Şu an seni en çok zorlayan konu ne?",
    subtitle: "En büyük zorluk noktası, sana uygun yapı ve salon tipini daha doğru belirlememizi sağlar.",
    helperText: "Buradaki cevap, öneri sıralamasında yaklaşım farkı yaratır.",
    badgeLabel: "Netleştiriyoruz",
    options: [
      { value: "Bel / boyun / sırt ağrısı", label: "Bel / boyun / sırt ağrısı", description: "Daha kontrollü, güvenli ve dikkatli ilerlemek istiyorum.", icon: "shield" },
      { value: "Hareketsizlik", label: "Hareketsizlik", description: "Günlük tempoma düzenli hareket eklemek istiyorum.", icon: "progress" },
      { value: "Kilo kontrolü", label: "Kilo kontrolü", description: "Takip edilebilir bir planla daha net sonuç görmek istiyorum.", icon: "measurements" },
      { value: "Düzenli devam edememek", label: "Düzenli devam edememek", description: "Takvime oturan sürdürülebilir bir ritim kurmak istiyorum.", icon: "calendar" },
      { value: "Stres / gerginlik", label: "Stres / gerginlik", description: "Beni rahatlatan ve iyi hissettiren bir akış arıyorum.", icon: "progress" },
      { value: "Diğer", label: "Diğer", description: "Tam olarak tek başlıkta toplanmayan farklı bir ihtiyacım var.", icon: "notes" },
    ],
  },
  {
    key: "expectation",
    icon: "salon",
    eyebrow: "Salon beklentisi",
    title: "Salon seçerken en çok neye bakarsın?",
    subtitle: "İlk listeyi yakınlık, kalite, ortam ve ders tipi beklentine göre daha düzgün sıralayacağız.",
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
    subtitle: "Bir sonraki adımda sana bu saatlere daha uygun salon ve slotları göstereceğiz.",
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
  const isAdvancing = useRef(false);
  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const activeValue = memberIntent[current.key];

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
