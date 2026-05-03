import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/providers/auth-session";
import { setPendingSalonJoinSlug } from "@/lib/local-preferences";
import { extractSalonSlugFromQrPayload } from "@/lib/salon-qr";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type CameraStatus = "unknown" | "granted" | "denied" | "unavailable";

type ScanMode = "camera" | "manual";

let CameraModule: any = null;

try {
  CameraModule = eval("require")("expo-camera");
} catch {
  CameraModule = null;
}

const CameraView = CameraModule?.CameraView as any;

function normalizeSlug(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default function ScanSalonQrScreen() {
  const router = useRouter();
  const { user, onboardingState } = useSession();

  const [mode, setMode] = useState<ScanMode>("camera");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(CameraModule ? "unknown" : "unavailable");
  const [manualValue, setManualValue] = useState("");
  const [scanLocked, setScanLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const activeSalonSlug = useMemo(() => normalizeSlug(user?.tenantSlug), [user?.tenantSlug]);
  const userIsActiveMember = user?.role === "MEMBER" && onboardingState === "ACTIVE_SALON";

  async function requestPermission() {
    if (!CameraModule?.requestCameraPermissionsAsync) {
      setCameraStatus("unavailable");
      return;
    }

    const result = await CameraModule.requestCameraPermissionsAsync();
    setCameraStatus(result?.status === "granted" ? "granted" : "denied");
  }

  async function handlePayload(payload: string) {
    if (isProcessing) return;

    setIsProcessing(true);
    setError("");
    setInfo("");

    const slug = extractSalonSlugFromQrPayload(payload);
    const normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug) {
      setError("Bu QR salon onboarding kodu değil. Admin salon QR ekranındaki kodu okutman gerekiyor.");
      setScanLocked(false);
      setIsProcessing(false);
      return;
    }

    if (userIsActiveMember) {
      if (activeSalonSlug && activeSalonSlug === normalizedSlug) {
        setInfo("Bu salona zaten kayıtlısın. Seni ana sayfana yönlendiriyoruz.");
        setManualValue("");
        setScanLocked(false);
        setIsProcessing(false);
        router.replace("/(member)/home" as never);
        return;
      }

      setError("Zaten aktif bir salona kayıtlısın. Yeni salon kayıt akışı başlatılamaz.");
      setScanLocked(false);
      setIsProcessing(false);
      router.replace("/(member)/home" as never);
      return;
    }

    await setPendingSalonJoinSlug(normalizedSlug);
    setManualValue("");
    setScanLocked(false);
    setIsProcessing(false);
    router.replace(`/(intake-member)/salons/${normalizedSlug}` as never);
  }

  function handleBarcodeScanned(event: any) {
    if (scanLocked || isProcessing) return;

    const payload = String(event?.data || "").trim();
    if (!payload) return;

    setScanLocked(true);
    void handlePayload(payload);
  }

  function handleModeChange(value: string) {
    const nextMode = value as ScanMode;

    setMode(nextMode);
    setError("");
    setInfo("");
    setScanLocked(false);
  }

  useEffect(() => {
    if (mode === "camera" && cameraStatus === "unknown") {
      void requestPermission();
    }
  }, [cameraStatus, mode]);

  return (
    <AppShell
      title="Salon QR okut"
      subtitle="Salonun onboarding QR kodunu okuttuğunda doğru kayıt ve paket akışına yönlendirilirsin."
      icon="scan"
      showBackButton
    >
      <SurfaceCard tone="primary">
        <View style={styles.heroHeader}>
          <AppIcon name="qr" size="sm" tone="primary" />
          <View style={styles.grow}>
            <Text style={styles.sectionTitle}>Salon onboarding</Text>
            <Text style={styles.copy}>
              Admin salon QR ekranındaki kare kodu okut. Eğer aktif bir salona kayıtlı değilsen, kayıt akışı bu salonla başlar.
            </Text>
          </View>
        </View>

        <SegmentedSwitch
          value={mode}
          onChange={handleModeChange}
          options={[
            { label: "Kamera", value: "camera" },
            { label: "Manuel", value: "manual" },
          ]}
        />
      </SurfaceCard>

      {userIsActiveMember ? (
        <SurfaceCard>
          <View style={styles.statusRow}>
            <StatusBadge label="Aktif salon mevcut" tone="info" />
            <Text style={styles.copy}>
              Aktif bir salona kayıtlı olduğun için farklı salon QR’ı yeni kayıt akışı başlatmaz.
            </Text>
          </View>
        </SurfaceCard>
      ) : null}

      {mode === "camera" ? (
        <SurfaceCard>
          {CameraView && cameraStatus === "granted" ? (
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
              />

              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={styles.scanWindow} />
                <Text style={styles.cameraHint}>
                  {scanLocked || isProcessing ? "Salon QR işleniyor..." : "Salon QR kodunu çerçeve içine getir"}
                </Text>
              </View>
            </View>
          ) : cameraStatus === "denied" ? (
            <View style={styles.stack}>
              <EmptyPanel
                title="Kamera izni gerekli"
                description="Canlı tarama için kamera erişimini açabilir veya manuel QR içeriği ile devam edebilirsin."
                iconName="scan"
                iconTone="warning"
              />
              <ActionButton label="İzni tekrar sor" icon="scan" onPress={() => void requestPermission()} />
              <ActionButton label="Ayarları aç" icon="profile" variant="ghost" onPress={() => void Linking.openSettings()} />
            </View>
          ) : cameraStatus === "unavailable" ? (
            <EmptyPanel
              title="Kamera kullanılamıyor"
              description="Bu cihazda kamera modülü kullanılamıyor. QR linkini manuel alana yapıştırarak devam edebilirsin."
              iconName="scan"
              iconTone="neutral"
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={tokens.colors.primaryStrong} />
              <Text style={styles.copy}>Kamera hazırlanıyor...</Text>
            </View>
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard>
          <FormField
            inputId="salon-qr-manual-input"
            label="QR içeriği"
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="https://.../join/demo-salon?code=..."
            multiline
            numberOfLines={4}
          />

          <ActionButton
            label={isProcessing ? "İşleniyor..." : "Salona devam et"}
            icon="scan"
            onPress={() => void handlePayload(manualValue)}
            disabled={!manualValue.trim() || isProcessing}
            loading={isProcessing}
          />
        </SurfaceCard>
      )}

      {info ? (
        <SurfaceCard tone="primary">
          <Text style={styles.copy}>{info}</Text>
        </SurfaceCard>
      ) : null}

      {error ? (
        <SurfaceCard tone="warning">
          <Text style={styles.errorText}>{error}</Text>
        </SurfaceCard>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: tokens.spacing.sm,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
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
  },
  statusRow: {
    gap: tokens.spacing.xs,
  },
  loadingBox: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
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
    fontFamily: tokens.fontFamily.semibold,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});