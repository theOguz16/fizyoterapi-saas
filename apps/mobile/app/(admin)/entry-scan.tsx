// Bu sayfa mobil uygulamada admin akisindaki entry scan ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { adminSalonEntryScanApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { SectionTitle } from "@/theme/components/section-title";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyPanel } from "@/theme/components/empty-panel";
import type { QrScanResult } from "@/lib/mobile-api";
import { tokens } from "@/theme/tokens";

type CameraStatus = "unknown" | "granted" | "denied" | "unavailable";

let CameraModule: any = null;
try {
  CameraModule = eval("require")("expo-camera");
} catch {
  CameraModule = null;
}

type ApiEnvelope<T> = T | { data?: T };

function unwrapApiData<T>(payload: ApiEnvelope<T>): T | undefined {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return payload.data;
  }

  return payload as T;
}

const CameraView = CameraModule?.CameraView as any;

export default function AdminEntryScanScreen() {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(CameraModule ? "unknown" : "unavailable");
  const [manualCode, setManualCode] = useState("");
  const [scanLocked, setScanLocked] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

 const mutation = useMutation({
  mutationFn: (payload: { qr_code?: string; manual_code?: string }) =>
    adminSalonEntryScanApi(payload),

  meta: {
  invalidates: [
    ["admin-dashboard"],
    ["admin-dashboard-v2"],
    ["admin-bookings"],

    ["member-home"],
    ["member-home-v2"],
    ["member-attendance-history"],
    ["member-packages"],
    ["member-my-packages"],

    ["trainer-checkin-logs"],
    ["trainer-bookings"],
    ["trainer-today"],
  ],
},

  onSuccess: (payload) => {
    const data = unwrapApiData<QrScanResult>(payload);

    setResultMessage(data?.message || "Salon girişi kaydedildi.");
    setManualCode("");
    setScanLocked(false);
  },

  onError: (error) => {
    setResultMessage(
      error instanceof Error ? error.message : "Salon girişi kaydedilemedi."
    );
    setScanLocked(false);
  },
});

  async function requestPermission() {
    if (!CameraModule?.requestCameraPermissionsAsync) {
      setCameraStatus("unavailable");
      return;
    }
    const result = await CameraModule.requestCameraPermissionsAsync();
    setCameraStatus(result?.status === "granted" ? "granted" : "denied");
  }

  function handleBarcodeScanned(event: any) {
    if (scanLocked || mutation.isPending) return;
    const code = String(event?.data || "").trim();
    if (!code) return;
    setScanLocked(true);
    mutation.mutate({ qr_code: code });
  }

  useEffect(() => {
    if (mode === "camera" && cameraStatus === "unknown") {
      void requestPermission();
    }
  }, [mode, cameraStatus]);

  return (
    <AppShell testID="admin-entry-scan-screen" title="Salon giriş tarama" subtitle="Resepsiyon noktasında üye girişini kaydet veya eğitmen kimliğini doğrula." icon="scan" showBackButton>
      <View style={styles.metricsRow}>
        <MetricCard label="Mod" value={mode === "camera" ? "Kamera" : "Manuel"} hint="Anlık seçim" icon="scan" />
        <MetricCard label="Kural" value="Tek giriş" hint="Aynı üye için kayıt kontrolü" icon="shield" />
      </View>
      <SurfaceCard tone="primary">
        <SectionTitle title="Tarama modu" subtitle="Üye QR'si burada salon girişi olarak, eğitmen QR'si ise kimlik doğrulama olarak yorumlanır." />
        <SegmentedSwitch value={mode} onChange={(value) => setMode(value as "camera" | "manual")} options={[{ label: "Kamera", value: "camera" }, { label: "Manuel", value: "manual" }]} />
      </SurfaceCard>

      {mode === "camera" ? (
        <SurfaceCard>
          <SectionTitle title="Kamera ile okut" subtitle="Kamera izni yalnız bu ekranda istenir." />
          {CameraView && cameraStatus === "granted" ? (
            <View style={styles.cameraFrame}>
              <CameraView style={StyleSheet.absoluteFillObject} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleBarcodeScanned} />
              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={styles.scanWindow} />
                <Text style={styles.cameraHint}>{scanLocked || mutation.isPending ? "QR işleniyor..." : "Üye QR kodunu çerçeve içine getir"}</Text>
              </View>
            </View>
          ) : cameraStatus === "denied" ? (
            <View style={styles.stack}>
              <EmptyPanel title="Kamera izni gerekli" description="Canlı tarama için kamera erişimini aç ya da manuel giriş moduna geç." iconName="scan" iconTone="warning" />
              <ActionButton label="İzni Tekrar Sor" icon="scan" onPress={() => void requestPermission()} />
              <ActionButton label="Ayarları Aç" icon="profile" variant="ghost" onPress={() => void Linking.openSettings()} />
            </View>
          ) : cameraStatus === "unavailable" ? (
            <EmptyPanel title="Kamera kullanılamıyor" description="Bu cihazda şu an canlı tarama yok. Manuel kod girişi ile devam et." iconName="scan" iconTone="neutral" />
          ) : (
            <ActivityIndicator color={tokens.colors.primaryStrong} />
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard>
          <SectionTitle title="Manuel giriş" subtitle="QR metni, telefon, e-posta veya kullanıcı kimliği ile giriş/doğrulama yap." />
          <FormField inputId="admin-entry-scan-manual-code-input" label="Kod" value={manualCode} onChangeText={setManualCode} placeholder="QR kodu, telefon veya e-posta" returnKeyType="done" onSubmitEditing={() => mutation.mutate({ manual_code: manualCode.trim() })} />
          <ActionButton testID="admin-entry-scan-submit" label="Salon girişini kaydet" icon="scan" onPress={() => mutation.mutate({ manual_code: manualCode.trim() })} loading={mutation.isPending} disabled={!manualCode.trim()} />
        </SurfaceCard>
      )}

      {resultMessage ? (
      <SurfaceCard testID="admin-entry-scan-result" tone={mutation.isError ? "warning" : "success"}>
        <Text style={styles.message}>{resultMessage}</Text>
      </SurfaceCard>
    ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  stack: { gap: tokens.spacing.sm },
  cameraFrame: {
    height: 320,
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#020617",
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
    fontWeight: "700",
    fontFamily: tokens.fontFamily.semibold,
  },
  message: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});
