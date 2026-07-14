import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { trainerManualCheckinApi, trainerQrCheckinApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

type CheckinMode = "camera" | "manual";

type CheckinPayload =
  | {
      type: "qr";
      qr_code: string;
      session_id?: string;
    }
  | {
      type: "manual";
      manual_code: string;
      session_id?: string;
    };

type CheckinResult = {
  attendanceId?: string;
  bookingId?: string | null;
  memberId?: string;
  result?: string;
  creditsDeducted?: number;
  remainingCredits?: number | string | null;
  userPackageId?: string | null;
  creditSource?: string | null;
  idempotent?: boolean;
  message?: string;
};

type ApiEnvelope<T> = T | { data?: T };

function unwrapData<T>(payload: ApiEnvelope<T> | undefined | null): T | null {
  if (!payload) return null;

  if (typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data ?? null;
  }

  return payload as T;
}

function getCheckinMessage(data: CheckinResult | null, error: unknown) {
  if (error instanceof Error) return error.message;

  const result = String(data?.result || "").trim();
  const message = String(data?.message || "").trim();

  if (message) return message;

  if (result === "CREDIT_DEDUCTED") return "Check-in tamamlandı. Üyenin hakkından 1 ders düşüldü.";
  if (result === "NO_CREDIT") return "Üyenin kullanılabilir paket hakkı bulunmuyor.";
  if (result === "PACKAGE_EXPIRED") return "Üyenin paket süresi dolduğu için işlem tamamlanamadı.";
  if (result === "USER_INACTIVE") return "Üye hesabı pasif olduğu için check-in yapılamadı.";

  if (data) return "Katılım işlemi tamamlandı.";

  return "";
}

function getCreditSourceLabel(value: unknown) {
  const source = String(value || "").trim();

  if (source === "PACKAGE") return "Paket hakkı";
  if (source === "REFERRAL_WALLET") return "Sadakat / referans hakkı";

  return "Otomatik eşleşme";
}

function getRemainingCreditsLabel(value: unknown) {
  const source = String(value || "").trim();

  if (source === "REFERRAL_WALLET") return "Kalan sadakat hakkı";
  if (source === "PACKAGE") return "Kalan paket hakkı";

  return "İşlem sonrası kalan";
}

export default function TrainerCheckinScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<CheckinMode>("camera");
  const [manualCode, setManualCode] = useState("");
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [scanLocked, setScanLocked] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: CheckinPayload) => {
      if (payload.type === "qr") {
        return trainerQrCheckinApi({
          qr_code: payload.qr_code,
          session_id: payload.session_id,
          scan_context: "TRAINER_CHECKIN",
        });
      }

      return trainerManualCheckinApi({
        manual_code: payload.manual_code,
        session_id: payload.session_id,
      });
    },

    meta: {
      invalidates: [
        ["trainer-home"],
        ["trainer-checkin-logs"],
        ["trainer-bookings"],
        ["trainer-today"],
        ["trainer-today-calendar"],
        ["trainer-earnings"],
        { queryKey: ["admin-trainer-bookings"], exact: false },
        { queryKey: ["admin-trainer-earnings"], exact: false },

        ["member-package-summary"],
        ["member-my-packages-list"],
        ["member-attendance-history"],
        ["member-home"],
        ["member-home-v2"],
        ["member-packages"],
        ["member-my-packages"],

        ["admin-bookings"],
        ["admin-dashboard"],
        ["admin-dashboard-v2"],
      ],
    },

    onSuccess: (_payload, variables) => {
      setManualCode("");

      if (variables.type === "manual") {
        setScanLocked(false);
      }

      // QR başarılı okununca scanner kilitli kalır.
      // Aynı QR ekranda duruyorsa ikinci kez otomatik hak düşümü tetiklenmesin.
    },

    onError: () => {
      setScanLocked(false);
    },
  });

  const responseData = unwrapData<CheckinResult>(mutation.data as ApiEnvelope<CheckinResult> | undefined | null);
  const resultCode = String(responseData?.result || "").trim();
  const resultMessage = getCheckinMessage(responseData, mutation.error);

  const isCreditDeducted = resultCode === "CREDIT_DEDUCTED";
  const isSuccess = isCreditDeducted || Boolean(mutation.isSuccess && !mutation.error);
  const isDuplicate = Boolean(responseData?.idempotent);

  const creditSourceLabel = getCreditSourceLabel(responseData?.creditSource);
  const remainingCreditsLabel = getRemainingCreditsLabel(responseData?.creditSource);

  const remainingCredits =
    responseData?.remainingCredits !== undefined && responseData?.remainingCredits !== null
      ? String(responseData.remainingCredits)
      : "Bekleniyor";

  const statusLabel = useMemo(() => {
    if (mutation.isPending) return "İşleniyor";
    if (isDuplicate) return "Zaten işlendi";
    if (isSuccess) return "Başarılı";
    if (mutation.isError) return "Kontrol et";
    return "Hazır";
  }, [isDuplicate, isSuccess, mutation.isError, mutation.isPending]);

  const statusTone = isSuccess ? "success" : mutation.isError ? "warning" : "info";

  function submitQrCode(code: string) {
    const normalizedCode = String(code || "").trim();

    if (!normalizedCode || scanLocked || mutation.isPending) return;

    setLastScannedCode(normalizedCode);
    setScanLocked(true);

    mutation.mutate({
      type: "qr",
      qr_code: normalizedCode,
      session_id: sessionId,
    });
  }

  function submitManualCode() {
    const normalizedCode = manualCode.trim().toUpperCase();

    if (!normalizedCode || mutation.isPending) return;

    mutation.mutate({
      type: "manual",
      manual_code: normalizedCode,
      session_id: sessionId,
    });
  }

  function handleBarcodeScanned(event: { data?: string }) {
    const code = String(event?.data || "").trim();
    submitQrCode(code);
  }

  function resetScanner() {
    setScanLocked(false);
    setLastScannedCode("");
    mutation.reset();
  }

  function changeMode(nextMode: CheckinMode) {
    setMode(nextMode);
    setScanLocked(false);
    setLastScannedCode("");
    mutation.reset();

    if (nextMode === "camera" && !permission?.granted) {
      void requestPermission();
    }
  }

  useEffect(() => {
    if (mode === "camera" && !permission) {
      void requestPermission();
    }
  }, [mode, permission, requestPermission]);

  return (
    <AppShell
      testID="trainer-checkin-screen"
      title="Ders girişi"
      subtitle="Üyenin QR kodunu okut veya MEM kodunu gir. Sistem o saatteki onaylı derse göre doğru paketten hak düşer."
      icon="scan"
      showBackButton
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Durum" value={statusLabel} hint="Anlık işlem" icon="shield" />
        <MetricCard label="Sonuç" value={remainingCredits} hint={creditSourceLabel} icon="checkin" />
      </View>

      <SurfaceCard tone="primary">
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Ders giriş yöntemi</Text>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </View>

        <Text style={styles.copy}>
          Üye sadece QR/MEM kodunu gösterir. Paket seçimi üyeden alınmaz; sistem ders saati, eğitmen ve ders tipine göre doğru paketi otomatik eşleştirir.
        </Text>

        <SegmentedSwitch
          testID="trainer-checkin-mode"
          value={mode}
          onChange={(value) => changeMode(value as CheckinMode)}
          options={[
            { label: "Kamera", value: "camera" },
            { label: "Manuel", value: "manual" },
          ]}
        />
      </SurfaceCard>

      {mode === "camera" ? (
        <SurfaceCard>
          <Text style={styles.title}>Kamera ile okut</Text>
          <Text style={styles.copy}>
            Üyenin QR kodunu çerçeve içine getir. QR algılandığında ders girişi otomatik başlar.
          </Text>
          <ActionButton testID="trainer-checkin-manual-mode" label="Manuel MEM kodu gir" icon="ticket" variant="ghost" onPress={() => changeMode("manual")} />

          {permission?.granted ? (
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanLocked || mutation.isPending ? undefined : handleBarcodeScanned}
              />

              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={styles.scanWindow} />
                <Text style={styles.cameraHint}>
                  {scanLocked || mutation.isPending ? "QR işleniyor..." : "Üye QR kodunu çerçeve içine getir"}
                </Text>
              </View>
            </View>
          ) : permission && !permission.granted ? (
            <View style={styles.stack}>
              <EmptyPanel
                title="Kamera izni gerekli"
                description="Canlı tarama için kamera erişimini açabilir veya manuel MEM kodu ile devam edebilirsin."
                iconName="scan"
                iconTone="warning"
              />
              <ActionButton label="İzni tekrar sor" icon="scan" onPress={() => void requestPermission()} />
              <ActionButton label="Ayarları aç" icon="profile" variant="ghost" onPress={() => void Linking.openSettings()} />
              <ActionButton testID="trainer-checkin-manual-mode" label="Manuel moda geç" icon="ticket" variant="ghost" onPress={() => changeMode("manual")} />
            </View>
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={tokens.colors.primaryStrong} />
              <Text style={styles.copy}>Kamera izni kontrol ediliyor...</Text>
              <ActionButton label="Kamera izni ver" icon="scan" onPress={() => void requestPermission()} />
              <ActionButton testID="trainer-checkin-manual-mode" label="Manuel MEM kodu gir" icon="ticket" variant="ghost" onPress={() => changeMode("manual")} />
            </View>
          )}

          {lastScannedCode ? (
            <View style={styles.scannedBox}>
              <Text style={styles.smallLabel}>Son okunan QR/MEM kodu</Text>
              <Text style={styles.scannedCode} numberOfLines={2}>
                {lastScannedCode}
              </Text>
            </View>
          ) : null}
        </SurfaceCard>
      ) : (
        <SurfaceCard>
          <Text style={styles.title}>Manuel MEM kodu ile ders girişi</Text>
          <Text style={styles.copy}>
            Üyenin QR ekranında görünen kısa MEM kodunu gir. Sistem o saatteki onaylı dersi bulur ve doğru paketten otomatik hak düşer.
          </Text>

          <FormField
            inputId="trainer-checkin-manual-input"
            label="Üye MEM kodu"
            value={manualCode}
            onChangeText={(value) => setManualCode(value.toUpperCase())}
            placeholder="MEM-DEMO001"
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={submitManualCode}
          />

          <ActionButton
            testID="trainer-checkin-submit"
            label="Ders girişini onayla"
            icon="checkin"
            onPress={submitManualCode}
            loading={mutation.isPending}
            disabled={!manualCode.trim() || mutation.isPending}
          />
        </SurfaceCard>
      )}

      {resultMessage ? (
        <SurfaceCard tone={isSuccess ? "success" : "warning"}>
          <View testID="trainer-checkin-result" style={styles.result}>
            <StatusBadge
              label={isSuccess ? (isDuplicate ? "Zaten işlendi" : "Başarılı") : "Kontrol et"}
              tone={isSuccess ? "success" : "warning"}
            />

            <Text style={styles.message}>{resultMessage}</Text>

            {isSuccess ? (
              <View style={styles.summaryBox}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Hak kaynağı</Text>
                  <Text style={styles.summaryValue}>{creditSourceLabel}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{remainingCreditsLabel}</Text>
                  <Text style={styles.summaryValue}>{remainingCredits}</Text>
                </View>
              </View>
            ) : null}

            {mode === "camera" ? (
              <ActionButton label="Yeni QR okut" icon="scan" variant="ghost" onPress={resetScanner} />
            ) : null}
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Text style={styles.title}>İşlem kuralı</Text>
        <Text style={styles.copy}>
          Check-in başarılı olduğunda sistem o saatteki onaylı dersi bulur. Üyenin o derse uygun aktif paketi varsa 1 hak düşer. Aynı ders için tekrar okutma yapılırsa ikinci kez hak düşülmez.
        </Text>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  stack: {
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  message: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  cameraFrame: {
    height: 320,
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#020617",
    marginTop: tokens.spacing.sm,
  },
  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,6,23,0.14)",
    gap: tokens.spacing.md,
  },
  scanWindow: {
    width: 210,
    height: 210,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
  },
  cameraHint: {
    color: "#F8FAFC",
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  loadingBox: {
    gap: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  scannedBox: {
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    gap: 4,
  },
  smallLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  scannedCode: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  result: {
    gap: tokens.spacing.sm,
  },
  summaryBox: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  summaryItem: {
    flex: 1,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    gap: 4,
  },
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
});
