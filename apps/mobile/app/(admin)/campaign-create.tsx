import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { ActionButton } from "@/theme/components/action-button";
import { createAdminCampaignApi, getAdminCampaignApi, updateAdminCampaignApi } from "@/lib/mobile-api";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

const AUDIENCES = [
  { label: "Tüm üyeler", value: "ALL" },
  { label: "Riskli üyeler", value: "RISK" },
  { label: "Yeni üyeler", value: "NEW" },
];

const TRIGGER_TYPES = [
  { label: "Referans", value: "REFERRAL" },
  { label: "Ders katılımı", value: "ATTENDANCE" },
];

const REWARD_TYPES = [
  { label: "Ücretsiz grup dersi", value: "GROUP_CLASS_CREDIT" },
];

const REWARD_TARGETS = [
  { label: "Referans olan", value: "REFERRER" },
  { label: "Yeni üye", value: "REFERRED" },
  { label: "Her ikisi", value: "BOTH" },
];

export default function AdminCampaignCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const campaignId = typeof params.id === "string" && params.id.trim() ? params.id.trim() : null;
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("ALL");

  const [triggerType, setTriggerType] = useState("REFERRAL");
  const [triggerCount, setTriggerCount] = useState("");

  const [rewardType, setRewardType] = useState("GROUP_CLASS_CREDIT");
  const [rewardValue, setRewardValue] = useState("");
  const [rewardTarget, setRewardTarget] = useState("REFERRER");
  const [isActive, setIsActive] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin-campaign", campaignId],
    queryFn: () => getAdminCampaignApi(campaignId || ""),
    enabled: Boolean(campaignId),
  });

  useEffect(() => {
    const campaign = detailQuery.data?.campaign;
    if (!campaign) return;

    setName(String(campaign.name || ""));
    setAudience(String(campaign.audience || "ALL"));
    setTriggerType(campaign.required_referrals ? "REFERRAL" : "ATTENDANCE");
    setTriggerCount(String(campaign.required_referrals || campaign.min_lessons || ""));
    setRewardType("GROUP_CLASS_CREDIT");
    setRewardValue(String(campaign.reward_value || ""));
    setRewardTarget(String(campaign.reward_target || "REFERRER"));
    setIsActive(campaign.is_active === true);
  }, [detailQuery.data]);

  const isEditing = useMemo(() => Boolean(campaignId), [campaignId]);
  const ruleLocked = Number(detailQuery.data?.campaign?.fulfillment_count || 0) > 0;

  const mutation = useMutation({
  mutationFn: async () =>
    isEditing
      ? updateAdminCampaignApi(campaignId || "", ruleLocked ? {
          name: name.trim(),
          is_active: isActive,
        } : {
          name: name.trim(),
          audience: audience as "ALL" | "RISK" | "NEW",
          trigger_count: Number(triggerCount),
          reward_type: "GROUP_CLASS_CREDIT",
          reward_value: Number(rewardValue),
          reward_target:
            triggerType === "REFERRAL"
              ? (rewardTarget as "REFERRER" | "REFERRED" | "BOTH")
              : undefined,
          is_active: isActive,
        })
      : createAdminCampaignApi({
          name: name.trim(),
          audience: audience as "ALL" | "RISK" | "NEW",
          trigger_type: triggerType as "REFERRAL" | "ATTENDANCE",
          trigger_count: Number(triggerCount),
          reward_type: "GROUP_CLASS_CREDIT",
          reward_value: Number(rewardValue),
          reward_target:
            triggerType === "REFERRAL"
              ? (rewardTarget as "REFERRER" | "REFERRED" | "BOTH")
              : undefined,
          is_active: isActive,
        }),

  meta: {
    invalidates: campaignId
      ? [
          ["admin-campaigns"],
          ["admin-settings"],
          ["admin-campaign", campaignId],
        ]
      : [
          ["admin-campaigns"],
          ["admin-settings"],
        ],
  },

  onSuccess: () => {
    showInfoAlert(
      isEditing ? "Kampanya güncellendi" : "Kampanya oluşturuldu",
      isEditing
        ? "Kampanya bilgileri kaydedildi."
        : "Yeni kampanya kampanya listesine eklendi."
    );

    router.replace("/(admin)/campaigns" as never);
  },

  onError: (error) => {
    showErrorAlert(
      isEditing ? "Kampanya güncellenemedi" : "Kampanya oluşturulamadı",
      error,
      "Kampanya kaydedilemedi. Lütfen alanları kontrol edip tekrar deneyin."
    );
  },
});

  const generateSummary = () => {
    let conditionText = "";
    let rewardText = "";
    let targetText = "";

    if (triggerType === "REFERRAL") {
      conditionText = `${triggerCount || "X"} kişi referans ile kayıt olduğunda`;
      const targetLabel = REWARD_TARGETS.find((t) => t.value === rewardTarget)?.label?.toLowerCase();
      targetText = targetLabel ? ` (${targetLabel} için)` : "";
    } else if (triggerType === "ATTENDANCE") {
      conditionText = `${triggerCount || "X"} derse katılım sağlandığında`;
    }

    rewardText = `${rewardValue || "X"} ücretsiz grup dersi kredisi cüzdana otomatik tanımlanacak`;

    return `${conditionText}, ${rewardText}${targetText}.`;
  };

  return (
    <AppShell
      testID="admin-campaign-editor-screen"
      title={isEditing ? "Kampanyayı düzenle" : "Yeni kampanya"}
      subtitle="Hedef kitle, koşul ve ödül kurallarını belirle."
      icon="campaigns"
      refreshing={detailQuery.isRefetching}
      onRefresh={campaignId ? () => void detailQuery.refetch() : undefined}
    >
      <SurfaceCard tone="primary">
        <FormField 
          inputId="admin-campaign-name-input"
          label="Kampanya adı" 
          value={name} 
          onChangeText={setName} 
          placeholder="Kampanya adını girin" 
        />
        <Text style={[styles.sectionTitle, { marginTop: tokens.spacing.sm }]}>Hedef kitle</Text>
        <View style={styles.chips}>
          {AUDIENCES.map((option) => (
            <SelectionChip 
              key={option.value} 
              testID={`admin-campaign-audience-${option.value.toLowerCase()}`}
              label={option.label} 
              active={audience === option.value} 
              onPress={() => { if (!ruleLocked) setAudience(option.value); }}
            />
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Kampanya koşulu</Text>
        <View style={styles.chips}>
          {TRIGGER_TYPES.map((option) => (
            <SelectionChip 
              key={option.value} 
              testID={`admin-campaign-trigger-${option.value.toLowerCase()}`}
              label={option.label} 
              active={triggerType === option.value} 
              onPress={() => { if (!ruleLocked) setTriggerType(option.value); }}
            />
          ))}
        </View>

        {triggerType === "REFERRAL" && (
          <FormField 
            inputId="admin-campaign-trigger-count-input"
            label="Gereken kayıt sayısı" 
            value={triggerCount} 
            onChangeText={setTriggerCount} 
            placeholder="Gerekli kayıt sayısını girin" 
            keyboardType="numeric" 
            editable={!ruleLocked}
          />
        )}

        {triggerType === "ATTENDANCE" && (
          <FormField 
            inputId="admin-campaign-trigger-count-input"
            label="Gereken ders sayısı" 
            value={triggerCount} 
            onChangeText={setTriggerCount} 
            placeholder="Gerekli ders sayısını girin" 
            keyboardType="numeric" 
            editable={!ruleLocked}
          />
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Kampanya ödülü</Text>
        <View style={styles.chips}>
          {REWARD_TYPES.map((option) => (
            <SelectionChip 
              key={option.value} 
              label={option.label} 
              active={rewardType === option.value} 
              onPress={() => { if (!ruleLocked) setRewardType(option.value); }}
            />
          ))}
        </View>

        {rewardType === "GROUP_CLASS_CREDIT" && (
          <FormField 
            inputId="admin-campaign-reward-value-input"
            label="Grup dersi adedi" 
            value={rewardValue} 
            onChangeText={setRewardValue} 
            placeholder="Hediye ders adedini girin" 
            keyboardType="numeric" 
            editable={!ruleLocked}
          />
        )}

        {triggerType === "REFERRAL" && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: tokens.spacing.sm }]}>Ödül kime tanımlanacak?</Text>
            <View style={styles.chips}>
              {REWARD_TARGETS.map((option) => (
                <SelectionChip 
                  key={option.value} 
                  testID={`admin-campaign-reward-target-${option.value.toLowerCase()}`}
                  label={option.label} 
                  active={rewardTarget === option.value} 
                  onPress={() => { if (!ruleLocked) setRewardTarget(option.value); }}
                />
              ))}
            </View>
          </>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Kural özeti</Text>
        <Text style={styles.summaryText}>{generateSummary()}</Text>
        <Text style={styles.helperText}>Hedef kitle kontrolü ödülü alacak üye için yapılır. Ödül kampanya başına bir kez teslim edilir.</Text>
        {ruleLocked ? <Text style={styles.lockedText}>Bu kampanyada ödül teslim edildiği için geçmiş raporun doğruluğunu koruyan kural alanları kilitlidir.</Text> : null}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Yayın durumu</Text>
        <View style={styles.chips}>
          <SelectionChip testID="admin-campaign-status-draft" label="Taslak" active={!isActive} onPress={() => setIsActive(false)} />
          <SelectionChip testID="admin-campaign-status-active" label="Aktif" active={isActive} onPress={() => setIsActive(true)} />
        </View>
        <Text style={styles.helperText}>
          {isActive ? "Koşulu sağlayan uygun üyelere ödül otomatik verilir." : "Kampanya kaydedilir ancak siz aktifleştirene kadar ödül üretmez."}
        </Text>
      </SurfaceCard>

      <ActionButton
        testID="admin-campaign-submit"
        label={isEditing ? "Kampanyayı güncelle" : "Kampanyayı oluştur"}
        icon="campaigns"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  summaryText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.medium,
    lineHeight: 22,
  },
  helperText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginTop: tokens.spacing.xs,
  },
  lockedText: {
    color: tokens.colors.warning,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
    marginTop: tokens.spacing.sm,
  },
});
