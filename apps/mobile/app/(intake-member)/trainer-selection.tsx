import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getSalonTrainerOptionsApi } from "@/lib/mobile-api";
import { updateSelectedPackage } from "@/lib/member-package-queue";
import { useAppFlow } from "@/providers/app-flow";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { EmptyState } from "@/theme/components/empty-state";
import { IntakeProgressCard } from "@/theme/components/intake-progress-card";
import { SelectionChip } from "@/theme/components/selection-chip";
import { tokens } from "@/theme/tokens";

export default function TrainerSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const { memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const [filter, setFilter] = useState<"ALL" | "AVAILABLE" | "BEST_MATCH">("AVAILABLE");

  const trainerQuery = useQuery({
    queryKey: ["intake-trainer-options", params.slug, memberBookingDraft.packageId],
    queryFn: () => getSalonTrainerOptionsApi(String(params.slug), memberBookingDraft.packageId),
  });

  const trainers = useMemo(() => {
    const source = trainerQuery.data;
    if (Array.isArray(source)) return source;
    return Array.isArray((source as any)?.data) ? (source as any).data : [];
  }, [trainerQuery.data]);
  const lessonCategory = useMemo(() => {
    const firstTrainer = trainers[0];
    return String(firstTrainer?.lesson_category || firstTrainer?.specialties?.[0] || "").trim();
  }, [trainers]);
  const sortedTrainers = useMemo(
    () =>
      [...trainers].sort((a: any, b: any) => {
        if (Boolean(a.is_available) === Boolean(b.is_available)) {
          return Number(b.matching_slots || 0) - Number(a.matching_slots || 0);
        }
        return a.is_available ? -1 : 1;
      }),
    [trainers]
  );
  const filteredTrainers = useMemo(() => {
    if (filter === "BEST_MATCH") {
      return sortedTrainers;
    }
    if (filter === "AVAILABLE") {
      return sortedTrainers.filter((trainer: any) => trainer.is_available !== false);
    }
    return sortedTrainers;
  }, [filter, sortedTrainers]);
  const bestTrainerId = sortedTrainers[0]?.id;

  return (
    <AppShell testID="intake-trainer-selection-screen" title="Eğitmen seç" subtitle="Paketine uygun eğitmenlerden birini seç. Sonraki adımda yalnız kendi saatlerini işaretleyeceksin." icon="trainer">
      <AnimatedEntrance>
        <IntakeProgressCard
          step={4}
          total={6}
          icon="trainer"
          eyebrow="Eğitmen seçimi"
          title="Paketine uygun eğitmeni seç"
          description="Burada yalnız seçtiğin pakete göre uygun görünen eğitmenleri listeliyoruz. Uygunluk eşleşmesi sistem tarafından arka planda kontrol ediliyor."
          badgeLabel={memberBookingDraft.packageTitle || "Paket seçildi"}
          badgeTone="success"
          summaryItems={[
            { label: "Salon", value: memberBookingDraft.salonName || "Henüz seçilmedi" },
            { label: "Paket", value: memberBookingDraft.packageTitle || "Henüz seçilmedi" },
            { label: "Kural", value: `${memberBookingDraft.requiredTrainerFreeSlots || 0} ortak saat gerekir` },
          ]}
          footnote="Bir sonraki adımda yalnız kendi uygun olduğun gün ve saatleri işaretleyeceksin."
        />
      </AnimatedEntrance>

      <AnimatedEntrance delay={60}>
        <SurfaceCard tone="primary">
          <Text style={styles.title}>{memberBookingDraft.packageTitle || "Paket seçimi"}</Text>
          <Text style={styles.copy}>{memberBookingDraft.packageSummary || "Seçtiğin paket için uygun eğitmenleri aşağıda görüyorsun."}</Text>
          <View style={styles.ruleRow}>
            <AppIcon name="spark" size="sm" tone="primary" />
            <Text style={styles.ruleText}>Hedef: en az {memberBookingDraft.requiredTrainerFreeSlots || 0} ortak saat yakalayabilen bir eşleşme.</Text>
          </View>
        </SurfaceCard>
      </AnimatedEntrance>

      <AnimatedEntrance delay={120}>
        <SurfaceCard>
          <Text style={styles.filterTitle}>Hızlı filtre</Text>
          <View style={styles.filterRow}>
            <SelectionChip label="Uygun olanlar" active={filter === "AVAILABLE"} onPress={() => setFilter("AVAILABLE")} />
            <SelectionChip label="En çok eşleşen" active={filter === "BEST_MATCH"} onPress={() => setFilter("BEST_MATCH")} />
            <SelectionChip label="Tümü" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          </View>
          {lessonCategory ? <Text style={styles.filterNote}>Ders türü: {lessonCategory}</Text> : null}
        </SurfaceCard>
      </AnimatedEntrance>

      {filteredTrainers.length === 0 ? (
        <EmptyState title="Şu anda uygun eğitmen görünmüyor" description="Bu paket için yeni eğitmen ataması bekleniyor olabilir. Daha sonra tekrar deneyebilirsin." icon="trainer" />
      ) : (
        filteredTrainers.map((trainer: any, index: number) => (
          <AnimatedEntrance key={trainer.id} delay={160 + index * 70}>
            <SurfaceCard tone={trainer.is_available !== false ? "primary" : "default"} padding="hero">
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.cardTitle}>{trainer.full_name || "Eğitmen"}</Text>
                  <Text style={styles.cardMeta}>{trainer.specialties?.join(" • ") || "Paketle uyumlu ders kategorileri mevcut."}</Text>
                </View>
                <Text style={[styles.matchBadge, trainer.is_available !== false ? styles.matchBadgeActive : null]}>
                  {String(trainer.id) === String(bestTrainerId) ? "En uygun" : resolveMatchLabel(Number(trainer.matching_slots || 0), memberBookingDraft.requiredTrainerFreeSlots || 0)}
                </Text>
              </View>
              <Text style={styles.copy}>{trainer.compatibility_note || "Bu eğitmen, seçtiğin paket kapsamında uygun dersleri verebilir."}</Text>
              <View style={styles.metaInfo}>
                <View style={styles.metaInfoRow}>
                  <AppIcon name="clock" size="sm" tone="primary" />
                  <Text style={styles.rule}>{Number(trainer.matching_slots || 0)} ortak saat</Text>
                </View>
                <View style={styles.metaInfoRow}>
                  <AppIcon name="trainer" size="sm" tone="primary" />
                  <Text style={styles.rule}>Ders türü: {lessonCategory || "Paket kategorisi ile uyumlu"}</Text>
                </View>
              </View>
              <ActionButton
                testID={`intake-trainer-select-${index}`}
                label="Bu eğitmeni seç"
                icon="trainer"
                onPress={() => {
                  setMemberBookingDraft({
                    ...memberBookingDraft,
                    trainerId: String(trainer.id),
                    trainerName: String(trainer.full_name || "Eğitmen"),
                    selectedPackages: memberBookingDraft.packageId
                      ? updateSelectedPackage(memberBookingDraft, String(memberBookingDraft.packageId), (pkg) => ({
                          ...pkg,
                          trainer_id: String(trainer.id),
                          trainer_name: String(trainer.full_name || "Eğitmen"),
                        }))
                      : memberBookingDraft.selectedPackages,
                  });
                  router.push({ pathname: "/(intake-member)/time-selection", params: { slug: String(params.slug) } } as never);
                }}
                disabled={trainer.is_available === false}
              />
            </SurfaceCard>
          </AnimatedEntrance>
        ))
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  cardMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  filterTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  filterNote: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  matchBadge: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  matchBadgeActive: {
    color: tokens.colors.primaryStrong,
    backgroundColor: "rgba(151,187,156,0.16)",
    borderColor: "rgba(111,146,116,0.2)",
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  rule: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
  ruleText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
  metaInfo: {
    gap: tokens.spacing.xs,
  },
  metaInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
});

function resolveMatchLabel(matchingSlots: number, requiredSlots: number) {
  if (matchingSlots <= 0) return "Eşleşme yok";
  if (matchingSlots >= requiredSlots && requiredSlots > 0) return "Güçlü eşleşme";
  if (matchingSlots + 1 >= requiredSlots) return "Sınırda eşleşme";
  return "Kısmi eşleşme";
}
