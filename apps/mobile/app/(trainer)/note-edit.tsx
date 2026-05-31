import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { patchTrainerMemberNoteApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const CATEGORIES = ["GENERAL", "GOAL", "RISK", "FOLLOW_UP"] as const;
type NoteCategory = (typeof CATEGORIES)[number];

function noteCategoryLabel(category: string) {
  if (category === "GOAL") return "Hedef";
  if (category === "RISK") return "Risk";
  if (category === "FOLLOW_UP") return "Takip";
  return "Genel";
}

function noteCategoryTone(category: string): "success" | "warning" | "danger" | "info" {
  if (category === "GOAL") return "success";
  if (category === "RISK") return "danger";
  if (category === "FOLLOW_UP") return "warning";
  return "info";
}

function noteCategoryIcon(category: string): AppIconName {
  if (category === "GOAL") return "target";
  if (category === "RISK") return "risk";
  if (category === "FOLLOW_UP") return "clock";
  return "notes";
}

function noteCategoryDescription(category: string) {
  if (category === "GOAL") return "Danışanın hedeflerini netleştirir ve ilerlemeyi görünür kılar.";
  if (category === "RISK") return "Sakatlık, motivasyon düşüşü veya devamsızlık riski gibi kritik sinyalleri işaretler.";
  if (category === "FOLLOW_UP") return "Bir sonraki görüşme, kontrol noktası veya alınacak aksiyonu sabitler.";
  return "Seans özeti, genel gözlem ve koç yorumları için uygundur.";
}

export default function TrainerNoteEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId: string; memberName?: string; noteId: string; title: string; body: string; category: string; backTo?: string | string[] }>();
  const [form, setForm] = useState({
    title: String(params.title || ""),
    body: String(params.body || ""),
    category: String(params.category || "GENERAL") as NoteCategory,
  });

  const mutation = useMutation({
  mutationFn: () =>
    patchTrainerMemberNoteApi(
      String(params.memberId),
      String(params.noteId),
      {
        title: form.title,
        body: form.body,
        category: form.category,
      }
    ),

  meta: {
    invalidates: [
      ["trainer-member-notes", params.memberId],
      ["trainer-member-detail", params.memberId],
      ["trainer-members"],
    ],
  },

  onSuccess: () => {
    router.replace({
      pathname: "/(trainer)/notes",
      params: {
        memberId: String(params.memberId),
        memberName: String(params.memberName || ""),
      },
    } as never);
  },
});

  const memberName = String(params.memberName || "Danışan");
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const categoryTone = noteCategoryTone(form.category);
  const categoryIconTone = form.category === "RISK" ? "danger" : form.category === "GOAL" ? "success" : form.category === "FOLLOW_UP" ? "warning" : "neutral";

  return (
    <AppShell
      title="Koç notunu düzenle"
      subtitle={`${memberName} için mevcut notu güncelleyin ve kategori bilgisini netleştirin.`}
      icon="notes"
      showBackButton
      onBack={() =>
        router.replace({
          pathname: "/(trainer)/notes",
          params: {
            memberId: String(params.memberId),
            memberName,
            backTo: backTo || "/(trainer)/clients",
          },
        } as never)
      }
    >
      <SurfaceCard tone="primary" padding="hero">
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Danışan</Text>
            <Text style={styles.memberName}>{memberName}</Text>
            <Text style={styles.helperText}>Bu değişiklik danışan detayındaki geçmiş notlar alanına anında yansır.</Text>
          </View>
          <StatusBadge label="Düzenleme" tone="primary" />
        </View>

        <View style={styles.categorySummary}>
          <View style={styles.categoryIdentity}>
            <AppIcon name={noteCategoryIcon(form.category)} size="sm" tone={categoryIconTone} />
            <View style={styles.categoryCopy}>
              <Text style={styles.categoryTitle}>{noteCategoryLabel(form.category)}</Text>
              <Text style={styles.categoryDescription}>{noteCategoryDescription(form.category)}</Text>
            </View>
          </View>
          <StatusBadge label="Seçili kategori" tone={categoryTone} />
        </View>

        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <SelectionChip key={category} label={noteCategoryLabel(category)} active={form.category === category} onPress={() => setForm((prev) => ({ ...prev, category }))} />
          ))}
        </View>

        <FormField
          label="Başlık"
          value={form.title}
          onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          placeholder="Örn. 2 haftalık takip değerlendirmesi"
          returnKeyType="next"
        />
        <FormField
          label="Not içeriği"
          value={form.body}
          onChangeText={(value) => setForm((prev) => ({ ...prev, body: value }))}
          placeholder="Notu düzenleyin"
          helper="Net aksiyon, gözlem ve zaman bilgisi eklemek geçmiş notları daha değerli kılar."
          multiline
          numberOfLines={7}
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.infoTitle}>Yayın öncesi kontrol</Text>
        <Text style={styles.infoCopy}>Başlıkta kısa bağlam verin, içerikte ise koç kararı, risk sinyali veya takip adımını açık yazın.</Text>
      </SurfaceCard>

      <ActionButton label="Değişiklikleri kaydet" icon="notes" onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.body.trim()} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: 0.8,
  },
  memberName: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  helperText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  categorySummary: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  categoryIdentity: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  categoryCopy: {
    flex: 1,
    gap: 2,
  },
  categoryTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  categoryDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  infoTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  infoCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
