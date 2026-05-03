// Bu paylaşılan UI component'i mobil tasarım sistemindeki QR preview parçası için standart görünüm sağlar.
// React Native'de QR önizleme için dataURL yerine react-native-qrcode-svg kullanılır.
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { tokens } from "../tokens";

type Props = {
  value?: string | null;
  size?: number;
  showCode?: boolean;
};

export function QrPreview({ value, size = 192, showCode = true }: Props) {
  const normalizedValue = String(value || "").trim();
  const qrSize = Math.max(120, size - 24);

  if (!normalizedValue) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.frame, { width: size, height: size }]}>
          <Text style={styles.fallbackTitle}>QR hazırlanıyor</Text>
          <Text style={styles.fallbackText}>Kod bilgisi bekleniyor.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { width: size, height: size }]}>
        <QRCode
          value={normalizedValue}
          size={qrSize}
          color={tokens.colors.text}
          backgroundColor="#FFFFFF"
          quietZone={8}
        />
      </View>

      {showCode ? (
        <Text style={styles.codeText} selectable numberOfLines={3}>
          {normalizedValue}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  frame: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#CFE8F7",
    backgroundColor: "#FFFFFF",
    padding: 12,
    ...tokens.shadow.soft,
  },
  fallbackTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  fallbackText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
    textAlign: "center",
    marginTop: 4,
  },
  codeText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    textAlign: "center",
    letterSpacing: 0.4,
    fontFamily: tokens.fontFamily.medium,
  },
});