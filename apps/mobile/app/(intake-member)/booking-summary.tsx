import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  createMemberPaymentRequestApi,
  getSalonTrainerOptionsApi,
} from "@/lib/mobile-api";
import { formatGroupClassPrice, getGroupClassAudienceLabel, isGroupClassBookingFlow } from "@/lib/group-classes";
import { applyCurrentPackageToDraft, findCurrentPackage, findNextUnsubmittedPackage } from "@/lib/member-package-queue";
import { buildBookingSummaryModel, buildMemberPurchaseDraft } from "@/lib/booking-summary";
import { safeBack } from "@/lib/navigation";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";
import { clearPendingSalonJoinSlug } from "@/lib/local-preferences";

export default function BookingSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const { memberIntent, memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const { refreshMe, user } = useSession();
  const isGroupFlow = isGroupClassBookingFlow(memberBookingDraft);
  const currentPackage = findCurrentPackage(memberBookingDraft);
  const requiresTrainer = !isGroupFlow;
  const selectedDaysForCurrentPackage = currentPackage?.preferred_slots || memberBookingDraft.preferredSlots;
  const isDuoFlow = String(currentPackage?.lesson_mode || memberBookingDraft.lessonMode || "").toUpperCase() === "DUO";
  const duoPartnerName = currentPackage?.duo_partner_name || memberBookingDraft.duoPartnerName || "";
  const duoPartnerContact = currentPackage?.duo_partner_contact || memberBookingDraft.duoPartnerContact || "";
  const isClinicContext = memberBookingDraft.entryContext === "CLINIC_LINK" && memberBookingDraft.salonSlug === String(params.slug || "");

  const trainerQuery = useQuery({
    queryKey: ["trainer-options", params.slug, currentPackage?.package_id || memberBookingDraft.packageId, selectedDaysForCurrentPackage],
    queryFn: () => getSalonTrainerOptionsApi(String(params.slug), currentPackage?.package_id || memberBookingDraft.packageId, selectedDaysForCurrentPackage),
  });

  const trainers = useMemo(() => trainerQuery.data || [], [trainerQuery.data]);
  const summary = useMemo(
    () => buildBookingSummaryModel(memberBookingDraft, trainers, requiresTrainer),
    [memberBookingDraft, requiresTrainer, trainers]
  );
  const { selectedTrainer, trainerWasAutoSelected, requiredPreferenceSlots, requiredTrainerFreeSlots } = summary;
  const normalizedSelectedSlotCount = selectedDaysForCurrentPackage.length;
  const { missingPreferenceSlots, missingTrainerSlots, hasTrainerSelection, canSubmit } = summary;

  function handleSubmissionSuccess() {
    const currentPackageId = String(currentPackage?.package_id || memberBookingDraft.packageId || "");
    const submittedPackageIds = Array.from(new Set([...(memberBookingDraft.submittedPackageIds || []), currentPackageId].filter(Boolean)));
    const draftAfterSubmit = {
      ...memberBookingDraft,
      submittedPackageIds,
    };
    const nextPackage = findNextUnsubmittedPackage(draftAfterSubmit);
    if (nextPackage) {
      if ((nextPackage.preferred_slots || []).length > 0) {
        setMemberBookingDraft(
          applyCurrentPackageToDraft(
            {
              ...draftAfterSubmit,
              groupClassFlow: {
                selectedLessonName: nextPackage.selected_sub_lesson || nextPackage.package_title || "",
                selectedGroupClassId: "",
                notificationScope: "SALON_MEMBERS",
                requiresAdminApproval: true,
              },
            },
            nextPackage.package_id
          )
        );
        router.replace({
          pathname: "/(intake-member)/booking-summary",
          params: { slug: String(params.slug), packageId: nextPackage.package_id },
        } as never);
        return;
      }

      setMemberBookingDraft(
        applyCurrentPackageToDraft(
          {
            ...draftAfterSubmit,
            preferredSlots: [],
            trainerId: "",
            trainerName: "",
            selectedSubLesson: "",
            groupClassFlow: undefined,
          },
          nextPackage.package_id
        )
      );
      router.replace({
        pathname: "/(intake-member)/package-detail",
        params: {
          slug: String(params.slug),
          id: nextPackage.package_id,
          title: String(nextPackage.package_title || ""),
          price: String(nextPackage.package_price || ""),
          summary: "",
          credits: String(nextPackage.total_credits || ""),
          weeklyClassHours: String(nextPackage.weekly_class_hours || ""),
          requiredPreferenceSlots: String(nextPackage.required_preference_slots || ""),
          requiredTrainerFreeSlots: String(nextPackage.required_trainer_free_slots || ""),
          subLessons: "",
        },
      } as never);
      return;
    }

    setMemberBookingDraft(draftAfterSubmit);
    router.replace("/(intake-member)/approval-pending" as never);
  }

  const submitMutation = useMutation({
  mutationFn: async () => {
    if (memberBookingDraft.e2eBypassSubmit) {
      return { ok: true };
    }

    return createMemberPaymentRequestApi(buildMemberPurchaseDraft({
      slug: String(params.slug),
      draft: memberBookingDraft,
      trainers,
      requiresTrainer,
      note: memberIntent.note,
    }));
  },

  meta: {
    invalidates: [
      ["me"],
      ["session"],
      ["member-home"],
      ["member-home-v2"],
      ["member-payment-requests"],
      ["member-change-requests"],
      ["my-salon-applications"],
      ["admin-approvals-v2"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"]
    ],
  },

  onSuccess: async () => {
    if (!memberBookingDraft.e2eBypassSubmit) {
      await clearPendingSalonJoinSlug();
      await refreshMe();
    }

    handleSubmissionSuccess();
  },
});

  return (
    <AppShell
      testID="intake-booking-summary-screen"
      title={isClinicContext ? "Klinik başvurunu gönder" : "Başvurunu gözden geçir"}
      subtitle={isGroupFlow ? "Seçtiğin grup dersi, seans bilgileri ve ücret özeti salon onayına gönderilecek." : "Seçtiğin paket, eğitmen ve uygunluk bilgileri salon onayına gönderilecek."}
      icon="approvals"
    >
      <AnimatedEntrance>
        <IntakeProgressCard
          step={isClinicContext ? 4 : 6}
          total={isClinicContext ? 4 : 6}
          icon="approvals"
          eyebrow="Son kontrol"
          title={isClinicContext ? "Klinik bağlantılı kısa akışın son adımı" : "Son kontrol adımındasın"}
          description={isClinicContext ? "QR veya davetle seçtiğin klinik, paket ve uygun saat bilgilerini son kez kontrol et." : "Başvurun gönderildiğinde salon ekibi seçimlerini birlikte değerlendirip sana geri bildirim verecek."}
          badgeLabel="Onaya hazır"
          badgeTone="warning"
          summaryItems={[
            { label: "Salon", value: memberBookingDraft.salonName || "-" },
            {
              label: "Paket",
              value:
                memberBookingDraft.selectedPackages && memberBookingDraft.selectedPackages.length > 1
                  ? `${memberBookingDraft.selectedPackages.length} paket`
                  : memberBookingDraft.packageTitle || "-",
            },
            { label: "Akış", value: requiresTrainer ? `${selectedTrainer?.full_name || memberBookingDraft.trainerName || "-"}${trainerWasAutoSelected ? " (öneri)" : ""}` : "Grup dersi katılımı" },
          ]}
          footnote={isGroupFlow ? "Talep gönderildiğinde ilgili seans için katılım isteğin oluşturulur; onay ve ücret bilgisi salon tarafından netleştirilir." : isDuoFlow ? "Bu başvuru senin %50 ödeme payınla açılır; partner payı tamamlanmadan paket aktif ders akışına alınmaz." : "Göndermeden önce saat seçimlerini ve ihtiyaç özetini son kez kontrol et."}
        />
      </AnimatedEntrance>

      <AnimatedEntrance delay={60}>
        <SurfaceCard tone="primary">
          <Text style={styles.section}>Başvuru özeti</Text>
          <Text style={styles.value}>{memberBookingDraft.salonName || "-"}</Text>
          <Text style={styles.copy}>
            {(memberBookingDraft.selectedPackages && memberBookingDraft.selectedPackages.length > 0
              ? memberBookingDraft.selectedPackages.map((item) => item.package_title || item.package_id).join(", ")
              : memberBookingDraft.packageTitle || "-")}{" "}
            • {requiresTrainer ? selectedTrainer?.full_name || memberBookingDraft.trainerName || "-" : memberBookingDraft.selectedSubLesson || "Grup dersi"}
          </Text>
          {memberBookingDraft.selectedSubLesson ? <Text style={styles.copy}>Alt ders: {memberBookingDraft.selectedSubLesson}</Text> : null}
          {isGroupFlow ? (
            <>
              <Text style={styles.copy}>Bildirim kapsamı: {getGroupClassAudienceLabel(memberBookingDraft.groupClassFlow?.notificationScope)}</Text>
              <Text style={styles.copy}>Tahmini ücret: {formatGroupClassPrice(memberBookingDraft.packagePrice)}</Text>
            </>
          ) : null}
          {isDuoFlow ? (
            <>
              <Text style={styles.copy}>Duo partner: {duoPartnerName || "-"}</Text>
              <Text style={styles.copy}>Partner iletişim: {duoPartnerContact || "-"}</Text>
              <Text style={styles.copy}>Ödeme planı: Senin payın %50, partner payı davet kabulünde tahsil edilir.</Text>
            </>
          ) : null}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={110} style={styles.metricsRow}>
        <MetricCard label="Gerekli slot" value={requiredPreferenceSlots} hint="Paket kuralı" icon="calendar" />
        <MetricCard label="Eğitmen boşluğu" value={requiredTrainerFreeSlots} hint="Onay eşiği" icon="trainer" />
        <MetricCard label="Seçilen saat" value={selectedDaysForCurrentPackage.length} hint="Onaya gidecek tercih" icon="clock" />
      </AnimatedEntrance>

      <AnimatedEntrance delay={160}>
        <SurfaceCard tone="primary">
          <Text style={styles.section}>Kontrol durumu</Text>
          <View style={styles.infoRow}>
            <AppIcon name="calendar" size="sm" tone="primary" />
            <Text style={styles.copy}>{isGroupFlow ? `Grup dersi akışında en az ${requiredPreferenceSlots} seans seçmen gerekiyor. Şu anda ${normalizedSelectedSlotCount} seans seçtin.` : `Bu paket için en az ${requiredPreferenceSlots} slot seçmen gerekiyor. Şu anda ${normalizedSelectedSlotCount} slot seçtin.`}</Text>
          </View>
          {!isGroupFlow ? (
            <View style={styles.infoRow}>
              <AppIcon name="trainer" size="sm" tone="primary" />
              <Text style={styles.copy}>Onay için seçtiğin slotların en az {requiredTrainerFreeSlots} tanesinde eğitmenin takvimi boş olmalı.</Text>
            </View>
          ) : null}
          {missingPreferenceSlots > 0 ? <Text style={styles.warning}>Devam etmek için {missingPreferenceSlots} saat daha seçmelisin.</Text> : null}
          {requiresTrainer && !hasTrainerSelection ? <Text style={styles.warning}>Onaya göndermeden önce bir eğitmen seçmelisin.</Text> : null}
          {requiresTrainer && missingTrainerSlots > 0 ? <Text style={styles.warning}>Eğitmen uygunluğu başvuru gönderildiğinde sistem tarafından yeniden kontrol edilecek.</Text> : null}
          {isGroupFlow ? <Text style={styles.success}>Katılım talebin, kapasite ve ücret kontrolüyle birlikte salon onayına iletilecek.</Text> : null}
          {isDuoFlow ? <Text style={styles.success}>Partner bilgisi ve ikiye bölünmüş ödeme planı salon onayına birlikte iletilecek.</Text> : null}
          {missingPreferenceSlots === 0 && missingTrainerSlots === 0 ? <Text style={styles.success}>Başvurun sistem kurallarına uygun görünüyor.</Text> : null}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={210}>
        <SurfaceCard>
          <Text style={styles.section}>Seçilen gün ve saatler</Text>
          {memberBookingDraft.preferredSlots.map((slot) => (
            <Text key={`${slot.package_id || "package"}-${slot.starts_at}`} style={styles.copy}>• {slot.label}</Text>
          ))}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={260}>
        <SurfaceCard>
          <Text style={styles.section}>Tercih özeti</Text>
          <Text style={styles.copy}>Hedef: {memberIntent.goal || "-"}</Text>
          <Text style={styles.copy}>Beklenti: {memberIntent.expectation || "-"}</Text>
          {memberIntent.note ? <Text style={styles.copy}>Not: {memberIntent.note}</Text> : null}
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={310}>
        <SurfaceCard>
          <Text style={styles.section}>{requiresTrainer ? "Seçilen eğitmen" : "Yerleşim tipi"}</Text>
          {requiresTrainer && selectedTrainer ? (
            <>
              <Text style={styles.value}>{selectedTrainer.full_name}</Text>
              <Text style={styles.copy}>
                {trainerWasAutoSelected
                  ? "Henüz manuel eğitmen seçmediğin için sistem ilk uygun eğitmeni önerdi. Salon onayında uygunluk tekrar kontrol edilir."
                  : isDuoFlow
                  ? "Bu eğitmen tek slotta iki kişilik duo dersi planlayacak."
                  : selectedTrainer.compatibility_note || "Seçtiğin paket için uygun görünüyor."}
              </Text>
              <StatusBadge label="Onay Bekliyor" tone="warning" />
            </>
          ) : !requiresTrainer ? (
            <>
              <Text style={styles.value}>Grup dersi yerleşimi</Text>
              <Text style={styles.copy}>Seçtiğin grup dersine katılım talebin salon tarafından incelenecek; kapasite ve ücret bilgisi onayla netleşecek.</Text>
              <StatusBadge label="İnceleme bekleniyor" tone="warning" />
            </>
          ) : (
            <Text style={styles.copy}>Eğitmen seçimi tamamlanmadı.</Text>
          )}
        </SurfaceCard>
      </AnimatedEntrance>

      <ActionButton label="Saatleri düzenle" icon="calendar" variant="ghost" onPress={() => safeBack(router, "/(intake-member)/time-selection")} />
      {!user && !memberBookingDraft.e2eBypassSubmit ? (
        <SurfaceCard tone="primary">
          <Text style={styles.section}>Başvuruyu göndermek için hesabınla devam et</Text>
          <Text style={styles.copy}>Salon, paket, eğitmen ve saat seçimlerin korunacak.</Text>
          <ActionButton
            label="Danışan hesabımla giriş yap"
            icon="member"
            onPress={() => router.push("/(auth)/login" as never)}
          />
          <ActionButton
            label="Bu kliniğe danışan olarak katıl"
            icon="spark"
            variant="ghost"
            onPress={() => router.push({ pathname: "/(auth)/member-register", params: { slug: String(params.slug) } } as never)}
          />
        </SurfaceCard>
      ) : (
        <ActionButton
          label="Onaya gönder"
          icon="approvals"
          onPress={() => {
            if (memberBookingDraft.e2eBypassSubmit) {
              handleSubmissionSuccess();
              return;
            }
            submitMutation.mutate();
          }}
          loading={submitMutation.isPending}
          disabled={memberBookingDraft.e2eBypassSubmit ? false : !canSubmit || submitMutation.isPending}
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
  value: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
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
  warning: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
  success: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
});
