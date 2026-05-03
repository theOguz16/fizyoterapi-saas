import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getTrainerMemberDetailApi, createTrainerMemberNoteApi, getTrainerMemberNotesApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { FormField } from "@/theme/components/form-field";
import { ScrollPanel } from "@/theme/components/scroll-panel";
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
  if (category === "GOAL") return "Performans, kilo veya alışkanlık hedefleri";
  if (category === "RISK") return "Sakatlık, devam riski veya operasyonel uyarılar";
  if (category === "FOLLOW_UP") return "Bir sonraki görüşme ve takip aksiyonları";
  return "Genel gözlem ve seans özetleri";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Tarih bilgisi yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi yok";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TrainerNotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId: string; memberName?: string }>();
  const [form, setForm] = useState({ title: "", body: "", category: "GENERAL" as NoteCategory });

  const detailQuery = useQuery({
    queryKey: ["trainer-member-detail-brief", params.memberId],
    queryFn: () => getTrainerMemberDetailApi(String(params.memberId)),
    enabled: Boolean(params.memberId) && !params.memberName,
  });

  const notesQuery = useQuery({
    queryKey: ["trainer-member-notes", params.memberId],
    queryFn: () => getTrainerMemberNotesApi(String(params.memberId)),
  });

 const mutation = useMutation({
  mutationFn: () => createTrainerMemberNoteApi(String(params.memberId), form),

  meta: {
    invalidates: [
      ["trainer-member-notes", params.memberId],
      ["trainer-member-detail", params.memberId],
      ["trainer-members"],
    ],
  },

  onSuccess: () => {
    setForm({ title: "", body: "", category: "GENERAL" });
  },
});

  const memberName = useMemo(() => {
    if (typeof params.memberName === "string" && params.memberName.trim()) return params.memberName;
    return detailQuery.data?.full_name || "Danışan";
  }, [detailQuery.data?.full_name, params.memberName]);

  const items = Array.isArray(notesQuery.data?.items) ? notesQuery.data.items : [];
  const selectedCategoryLabel = noteCategoryLabel(form.category);

  return (
    <AppShell
      title="Koç notları"
      subtitle={`${memberName} için görüşme özeti, hedef, risk ve takip kayıtlarını düzenli biçimde tutun.`}
      icon="notes"
      showBackButton
      onBack={() =>
        router.replace({
          pathname: "/(trainer)/members/[id]",
          params: { id: String(params.memberId) },
        } as never)
      }
    >
      <SurfaceCard tone="primary" padding="hero">
        <View style={styles.memberHeader}>
          <View style={styles.memberIdentity}>
            <Text style={styles.sectionEyebrow}>Danışan</Text>
            <Text style={styles.memberName}>{memberName}</Text>
            <Text style={styles.memberMeta}>Notlar kategori bazlı saklanır ve geçmişte filtrelenmeden okunabilir.</Text>
          </View>
          <StatusBadge label={`${items.length} not`} tone="primary" />
        </View>

        <View style={styles.categoryPanel}>
          <View style={styles.categoryPanelHeader}>
            <View style={styles.categoryPanelTitleRow}>
              <AppIcon name={noteCategoryIcon(form.category)} tone={form.category === "RISK" ? "danger" : form.category === "GOAL" ? "success" : form.category === "FOLLOW_UP" ? "warning" : "neutral"} size="sm" />
              <Text style={styles.categoryPanelTitle}>{selectedCategoryLabel}</Text>
            </View>
            <StatusBadge label="Aktif kategori" tone={noteCategoryTone(form.category)} />
          </View>
          <Text style={styles.categoryPanelCopy}>{noteCategoryDescription(form.category)}</Text>
        </View>

        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <SelectionChip
              key={category}
              label={noteCategoryLabel(category)}
              active={form.category === category}
              onPress={() => setForm((prev) => ({ ...prev, category }))}
            />
          ))}
        </View>

        <FormField
          label="Başlık"
          value={form.title}
          onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          placeholder="Örn. Haftalık değerlendirme"
          returnKeyType="next"
        />
        <FormField
          label="Not içeriği"
          value={form.body}
          onChangeText={(value) => setForm((prev) => ({ ...prev, body: value }))}
          placeholder="Danışanla ilgili gözlem, karar ve takip adımlarını yazın"
          helper="Kısa aksiyon maddeleri ve net gözlemler bu alanı daha okunur yapar."
          multiline
          numberOfLines={6}
        />
        <ActionButton label="Notu kaydet" icon="notes" onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.body.trim()} />
      </SurfaceCard>

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Geçmiş notlar</Text>
        <Text style={styles.historySubtitle}>Kategori, içerik ve güncelleme zamanıyla birlikte listelenir.</Text>
      </View>

      {items.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <AppIcon name="notes" size="lg" tone="neutral" />
          <Text style={styles.emptyTitle}>Henüz koç notu yok</Text>
          <Text style={styles.emptyCopy}>İlk notu ekleyerek danışanın hedeflerini, risklerini ve takip planını tek yerde toplamaya başlayın.</Text>
        </SurfaceCard>
      ) : (
        <ScrollPanel maxHeight={440}>
          {items.map((item: any) => {
            const category = String(item.category || "GENERAL");
            const tone = noteCategoryTone(category);
            const iconTone = category === "RISK" ? "danger" : category === "GOAL" ? "success" : category === "FOLLOW_UP" ? "warning" : "neutral";
            return (
              <SurfaceCard key={item.id} style={styles.noteCard}>
                <View style={styles.noteCardHeader}>
                  <View style={styles.noteIdentity}>
                    <AppIcon name={noteCategoryIcon(category)} size="sm" tone={iconTone} />
                    <View style={styles.noteTitleWrap}>
                      <Text style={styles.noteTitle}>{item.title || `${noteCategoryLabel(category)} notu`}</Text>
                      <Text style={styles.noteTime}>Son güncelleme: {formatDateTime(item.updated_at || item.created_at)}</Text>
                    </View>
                  </View>
                  <StatusBadge label={noteCategoryLabel(category)} tone={tone} />
                </View>

                <Text style={styles.noteBody}>{item.body || item.note || "-"}</Text>
                <View style={styles.noteFooter}>
                  <Text style={styles.noteFooterCopy}>{noteCategoryDescription(category)}</Text>
                  <ActionButton
                    label="Düzenle"
                    icon="notes"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() =>
                      router.push({
                        pathname: "/(trainer)/note-edit",
                        params: {
                          memberId: String(params.memberId),
                          memberName,
                          noteId: String(item.id),
                          title: String(item.title || ""),
                          body: String(item.body || item.note || ""),
                          category,
                        },
                      } as never)
                    }
                  />
                </View>
              </SurfaceCard>
            );
          })}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  memberIdentity: {
    flex: 1,
    gap: 4,
  },
  sectionEyebrow: {
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
  memberMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  categoryPanel: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  categoryPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  categoryPanelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  categoryPanelTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  categoryPanelCopy: {
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
  historyHeader: {
    gap: 4,
    paddingHorizontal: 4,
  },
  historyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  historySubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: tokens.spacing.xl,
  },
  emptyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  emptyCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    textAlign: "center",
  },
  noteCard: {
    gap: tokens.spacing.md,
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  noteIdentity: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  noteTitleWrap: {
    flex: 1,
    gap: 2,
  },
  noteTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  noteTime: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  noteBody: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 24,
    fontFamily: tokens.fontFamily.regular,
  },
  noteFooter: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  noteFooterCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
});
