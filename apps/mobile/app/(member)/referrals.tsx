// Bu sayfa mobil uygulamada member akisindaki referrals ekranini temsil eder.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { createMemberReferralApi, getMemberReferralsApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

export default function MemberReferralsScreen() {
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeContact, setInviteeContact] = useState("");

  const query = useQuery({
    queryKey: ["member-referrals"],
    queryFn: getMemberReferralsApi,
  });

  const mutation = useMutation({
  mutationFn: () =>
    createMemberReferralApi({
      invitee_name: inviteeName.trim(),
      invitee_phone_or_email: inviteeContact.trim(),
    }),

  meta: {
    invalidates: [
      ["member-referrals"],
      ["member-home"],
      ["member-home-v2"],
    ],
  },

  onSuccess: () => {
    setInviteeName("");
    setInviteeContact("");
  },
});

  const items = Array.isArray(query.data?.items) ? query.data.items : Array.isArray(query.data) ? query.data : [];
  
  // İstatistikleri hesapla
  const completedCount = items.filter((item: any) => 
    ["COMPLETED", "REWARDED", "CONVERTED"].includes(String(item.status || "").toUpperCase())
  ).length;
  const pendingCount = items.length - completedCount;

  return (
    <AppShell 
      title="Referanslar" 
      subtitle="Arkadaşlarını davet et, birlikte kazanmanın keyfini çıkar." 
      icon="referral"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {/* 1. ÜST METRİKLER (Spread Operator ile birleştirilmiş SurfaceCard Stilleri) */}
      <View style={styles.metricsRow}>
        <SurfaceCard style={{ ...styles.metricSurface, ...styles.metricSurfacePrimary }} padding="compact">
          <AppIcon name="referral" size="sm" tone="primary" />
          <Text style={styles.metricValue}>{items.length}</Text>
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Toplam</Text>
        </SurfaceCard>
        
        <SurfaceCard style={{ ...styles.metricSurface, ...styles.metricSurfaceWarning }} padding="compact">
          <AppIcon name="clock" size="sm" tone="warning" />
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Bekleyen</Text>
        </SurfaceCard>
        
        <SurfaceCard style={{ ...styles.metricSurface, ...styles.metricSurfaceSuccess }} padding="compact">
          <AppIcon name="gift" size="sm" tone="success" />
          <Text style={styles.metricValue}>{completedCount}</Text>
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Kazanılan</Text>
        </SurfaceCard>
      </View>

      {/* 2. DAVET ETME FORMU */}
      <SurfaceCard tone="primary">
        <View style={styles.cardHeader}>
          <AppIcon name="gift" size="sm" tone="primary" />
          <Text style={styles.sectionTitle}>Arkadaşını Davet Et</Text>
        </View>
        <Text style={styles.copy}>
          Arkadaşın salonumuza kayıt olup ilk paketini aldığında, ikiniz de özel kullanım hakları kazanırsınız.
        </Text>
        <FormField
          inputId="member-referral-name-input"
          label="Arkadaşının adı"
          value={inviteeName}
          onChangeText={setInviteeName}
          placeholder="Ad Soyad"
        />
        <FormField 
          inputId="member-referral-contact-input"
          label="E-posta veya Telefon" 
          value={inviteeContact} 
          onChangeText={setInviteeContact} 
          placeholder="Arkadaşının iletişim bilgisi" 
        />
        <ActionButton 
          testID="member-referral-submit"
          label="Davet Gönder" 
          icon="referral" 
          onPress={() => mutation.mutate()} 
          loading={mutation.isPending} 
          disabled={!inviteeName.trim() || !inviteeContact.trim()}
        />
      </SurfaceCard>

      {/* 3. ÖDÜL KURALI BİLGİSİ */}
      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="notes" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Ödül Nasıl Çalışır?</Text>
        </View>
        <View style={styles.infoStep}>
          <Text style={styles.infoText}>• Davet ettiğin arkadaşın sisteme kayıt olur.</Text>
          <Text style={styles.infoText}>• Belirlenen kampanya eşiği (örn: ilk paket alımı) tamamlanır.</Text>
          <Text style={styles.infoText}>• Kazancın otomatik olarak "Kalan Haklar"ına eklenir.</Text>
        </View>
      </SurfaceCard>

      {/* 4. GEÇMİŞ LİSTESİ */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Davet Geçmişi</Text>
        {items.length === 0 ? (
          <EmptyState 
            title="Henüz davetin yok" 
            description="İlk davetini gönderdiğinde süreç takibi burada listelenecek." 
            icon="referral" 
          />
        ) : (
          <ScrollPanel maxHeight={420}>
            {items.map((item: any) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.grow}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {item.invitee_name || item.invitee_phone_or_email || "Davetli"}
                    </Text>
                    <Text style={styles.historySubtitle} numberOfLines={1}>
                      {item.invitee_phone_or_email}
                    </Text>
                  </View>
                  <StatusBadge 
                    label={translateStatus(item.status)} 
                    tone={getBadgeTone(item.status)} 
                  />
                </View>
                <View style={styles.historyFooter}>
                  <AppIcon name="gift" size="sm" tone="neutral" />
                  <Text style={styles.rewardText}>
                    Ödül: {item.reward_label || "Süreç tamamlandığında belirlenecek"}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollPanel>
        )}
      </View>
    </AppShell>
  );
}

// Yardımcı Fonksiyonlar (Status yönetimi)
function translateStatus(status: string) {
  const s = String(status || "").toUpperCase();
  if (s.includes("COMPLETED") || s.includes("REWARDED")) return "Tamamlandı";
  if (s.includes("CONVERTED")) return "Kayıt Oldu";
  if (s.includes("CANCELED")) return "İptal";
  return "Bekliyor";
}

function getBadgeTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const s = String(status || "").toUpperCase();
  if (s.includes("COMPLETED") || s.includes("REWARDED")) return "success";
  if (s.includes("CANCELED")) return "danger";
  if (s.includes("CONVERTED")) return "neutral";
  return "warning";
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  
  // Renkli SurfaceCard Stilleri
  metricSurface: {
    flex: 1, 
    minWidth: 0,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricSurfacePrimary: {
    backgroundColor: "#EFF6FF",
    borderColor: "rgba(59,130,246,0.18)",
  },
  metricSurfaceWarning: {
    backgroundColor: "#FFF8EF",
    borderColor: "rgba(245,158,11,0.2)",
  },
  metricSurfaceSuccess: {
    backgroundColor: "#F4FBF7",
    borderColor: "rgba(34,197,94,0.18)",
  },
  metricValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  metricLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm,
  },
  infoStep: {
    gap: 4,
    marginTop: tokens.spacing.xs,
  },
  infoText: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  listSection: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  historyCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  historyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  historySubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
    marginTop: 2,
  },
  historyFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  rewardText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
