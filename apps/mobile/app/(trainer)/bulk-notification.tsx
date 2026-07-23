import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getTrainerMembersApi, sendTrainerBulkNotificationApi } from "@/lib/mobile-api";
import { showInfoAlert } from "@/lib/user-feedback";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { ActionButton } from "@/theme/components/action-button";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

const TEMPLATES = [
  { label: "Ders hatırlatma", title: "Ders hatırlatması", body: "Yaklaşan dersini uygulamadaki takviminden kontrol edebilirsin." },
  { label: "Program güncellemesi", title: "Program güncellemesi", body: "Ders programında güncelleme var. Güncel saatleri takvim ekranından inceleyebilirsin." },
  { label: "Ölçüm zamanı", title: "Ölçüm hatırlatması", body: "Gelişimini karşılaştırmak için yeni ölçüm zamanın geldi." },
];

export default function TrainerBulkNotificationScreen() {
  const membersQuery = useQuery({ queryKey: ["trainer-members"], queryFn: getTrainerMembersApi });
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(TEMPLATES[0].title);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const members = useMemo(() => membersQuery.data || [], [membersQuery.data]);
  const mutation = useMutation({
    mutationFn: () => sendTrainerBulkNotificationApi({ member_ids: selected, title, body }),
    onSuccess: (result: any) => showInfoAlert("Bildirim gönderildi", `${result?.delivered || 0} üyeye teslim edildi.`),
  });
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  return (
    <AppShell testID="trainer-bulk-notification-screen" title="Toplu bildirim" subtitle="Seçili danışanlara şablon kullanarak mesaj gönder ve teslim sonucunu gör." icon="notifications" showBackButton refreshing={membersQuery.isRefetching} onRefresh={() => void membersQuery.refetch()}>
      <SurfaceCard>
        <Text style={styles.section}>Mesaj şablonu</Text>
        <View style={styles.chips}>{TEMPLATES.map((template, index) => <SelectionChip testID={`trainer-bulk-notification-template-${index}`} key={template.label} label={template.label} active={title === template.title} onPress={() => { setTitle(template.title); setBody(template.body); }} />)}</View>
        <FormField inputId="trainer-bulk-notification-title-input" label="Başlık" value={title} onChangeText={setTitle} placeholder="Bildirim başlığı" />
        <FormField inputId="trainer-bulk-notification-body-input" label="Mesaj" value={body} onChangeText={setBody} placeholder="Mesajını yaz" multiline numberOfLines={4} />
      </SurfaceCard>
      <SurfaceCard>
        <View style={styles.header}><Text style={styles.section}>Danışanlar</Text><StatusBadge label={`${selected.length} seçili`} tone="info" /></View>
        <View style={styles.chips}>{members.map((member: any, index: number) => <SelectionChip testID={`trainer-bulk-notification-member-${index}`} key={member.id} label={member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Üye"} active={selected.includes(String(member.id))} onPress={() => toggle(String(member.id))} />)}</View>
        <ActionButton testID="trainer-bulk-notification-submit" label="Seçili üyelere gönder" icon="notifications" loading={mutation.isPending} disabled={!selected.length || !body.trim()} onPress={() => mutation.mutate()} />
      </SurfaceCard>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  section: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs },
});
