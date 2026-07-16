import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { LegalConsentSelection } from "@/lib/legal-consent";
import { tokens } from "@/theme/tokens";

const LEGAL_URLS = {
  terms: "https://fizyoflow.com/kullanim-sartlari",
  notice: "https://fizyoflow.com/kvkk",
  privacy: "https://fizyoflow.com/gizlilik-politikasi",
};

type Props = {
  value: LegalConsentSelection;
  onChange: (next: LegalConsentSelection) => void;
  context: "CLINIC_OWNER" | "CLINIC_MEMBER";
};

export function LegalConsentGroup({ value, onChange, context }: Props) {
  const purpose =
    context === "CLINIC_OWNER"
      ? "Kimlik ve iletişim bilgilerin hesabını açmak, kliniğini kurmak, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek için işlenir."
      : "Kimlik ve iletişim bilgilerin hesabını açmak ve seçtiğin kliniğe başvuru akışını yürütmek için işlenir. Sağlık bilgisi bu kayıt ekranında istenmez.";

  return (
    <View style={styles.container}>
      <Text style={styles.purpose}>{purpose}</Text>
      <ConsentRow
        testID="legal-terms-checkbox"
        checked={value.termsAccepted}
        label="Kullanım Şartları'nı okudum ve kabul ediyorum. (Zorunlu)"
        onPress={() => onChange({ ...value, termsAccepted: !value.termsAccepted })}
      />
      <ConsentRow
        testID="legal-notice-checkbox"
        checked={value.privacyNoticeAcknowledged}
        label="KVKK Aydınlatma Metni'ni okudum ve verilerimin işlenmesi hakkında bilgi edindim. (Zorunlu)"
        onPress={() => onChange({ ...value, privacyNoticeAcknowledged: !value.privacyNoticeAcknowledged })}
      />
      <ConsentRow
        testID="legal-marketing-checkbox"
        checked={value.marketingConsent}
        label="Ürün duyuruları ve kampanyalar için elektronik ileti almak istiyorum. (İsteğe bağlı)"
        onPress={() => onChange({ ...value, marketingConsent: !value.marketingConsent })}
      />
      <View style={styles.links}>
        <LegalLink label="Kullanım Şartları" url={LEGAL_URLS.terms} />
        <LegalLink label="KVKK Aydınlatma Metni" url={LEGAL_URLS.notice} />
        <LegalLink label="Gizlilik Politikası" url={LEGAL_URLS.privacy} />
      </View>
      <Text style={styles.retention}>
        Saklama süreleri, aktarım alıcıları ve KVKK kapsamındaki hakların Aydınlatma Metni'nde açıklanır. Pazarlama tercihini daha sonra değiştirebilirsin.
      </Text>
    </View>
  );
}

function ConsentRow({ testID, checked, label, onPress }: { testID: string; checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.box, checked ? styles.boxActive : null]}>
        <Text style={styles.mark}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.sm },
  purpose: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, lineHeight: 18, fontFamily: tokens.fontFamily.regular },
  row: { flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.sm, paddingVertical: tokens.spacing.xs },
  pressed: { opacity: 0.9 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { backgroundColor: tokens.colors.primaryStrong, borderColor: tokens.colors.primaryStrong },
  mark: { color: "#FFFFFF", fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.bold },
  label: { flex: 1, color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.medium },
  links: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.md },
  link: { color: tokens.colors.primaryStrong, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.semibold, textDecorationLine: "underline" },
  retention: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, lineHeight: 18, fontFamily: tokens.fontFamily.regular },
});
