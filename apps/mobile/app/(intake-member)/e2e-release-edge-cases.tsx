import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  approveAdminMobileItemApi,
  createAdminPackageApi,
  createAdminPackageAssignmentApi,
  createMemberPaymentRequestApi,
  getAdminMobileApprovalsApi,
  getAdminPackageAssignmentsApi,
  getAdminPackagesApi,
  getAdminTrainersApi,
  getMemberMyPackagesApi,
  getMemberPaymentRequestsApi,
  loginApi,
  type AdminPackage,
} from "@/lib/mobile-api";
import { ApiClientError } from "@/lib/api-error";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { setAuthToken } from "@/lib/http-client";
import { tokens } from "@/theme/tokens";

const TENANT_SLUG = "demo-salon";
const ADMIN_EMAIL = "oguzhanuyar531@gmail.com";
const ADMIN_PASSWORD = "admin123";
const MEMBER_EMAIL = "member@gmail.com";
const MEMBER_PASSWORD = "member123";
const TRAINER_EMAIL = "elisauyar@gmail.com";
const MULTI_EMAIL = "multi.persona@demo.local";
const MULTI_PASSWORD = "multi123";

type StepStatus = "pending" | "running" | "passed" | "failed";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

export default function E2EReleaseEdgeCasesScreen() {
  const [steps, setSteps] = useState<Step[]>([
    { key: "persona", label: "Aynı hesapta rol geçişi", status: "pending" },
    { key: "paymentPendingReject", label: "Ödeme bekliyor ve admin reddi", status: "pending" },
    { key: "secondPackage", label: "Aktif üyeye ikinci paket ekleme", status: "pending" },
    { key: "packageModes", label: "Özel, grup ve duo paket ayrımı", status: "pending" },
    { key: "apiErrors", label: "API hata mesajları", status: "pending" },
  ]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const summary = useMemo(() => {
    if (error) return "Release edge-case senaryosu hata aldı";
    if (done) return "Release edge-case senaryosu geçti";
    return "Release edge-case senaryosu çalışıyor";
  }, [done, error]);

  useEffect(() => {
    if (!isE2EModeEnabled()) return;
    let cancelled = false;

    const updateStep = (key: string, status: StepStatus, detail?: string) => {
      if (cancelled) return;
      setSteps((current) => current.map((step) => (step.key === key ? { ...step, status, detail } : step)));
    };

    async function run() {
      try {
        updateStep("persona", "running");
        await verifyMultiPersonaRouting();
        updateStep("persona", "passed", "MEMBER -> TRAINER -> ADMIN");

        await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
        const trainer = await findTrainer();
        const runId = Date.now();
        const privatePackage = await ensurePackage(`E2E Private Edge ${runId}`, "PRIVATE", 1, trainer.id);
        const groupPackage = await ensurePackage(`E2E Group Edge ${runId}`, "GROUP", 4, trainer.id);
        const duoPackage = await ensurePackage(`E2E Duo Edge ${runId}`, "DUO", 2, trainer.id);

        updateStep("paymentPendingReject", "running");
        await verifyPaymentPendingAndReject(privatePackage, trainer.id);
        updateStep("paymentPendingReject", "passed", "PENDING -> REJECTED");

        updateStep("secondPackage", "running");
        await verifySecondPackagePurchase(privatePackage, trainer.id);
        updateStep("secondPackage", "passed", privatePackage.title);

        updateStep("packageModes", "running");
        await verifyPackageModes({ privatePackage, groupPackage, duoPackage, trainerId: trainer.id });
        updateStep("packageModes", "passed", "PRIVATE / GROUP / DUO");

        updateStep("apiErrors", "running");
        await verifyApiErrorCopy(privatePackage, trainer.id);
        updateStep("apiErrors", "passed", "Salon bulunamadı");

        if (!cancelled) setDone(true);
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "Bilinmeyen hata";
        if (!cancelled) {
          setError(message);
          setSteps((current) => current.map((step) => (step.status === "running" ? { ...step, status: "failed", detail: message } : step)));
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      {!done && !error ? <ActivityIndicator size="large" color={tokens.colors.primaryStrong} /> : null}
      <Text style={[styles.title, error ? styles.errorText : done ? styles.successText : null]}>{summary}</Text>
      <View style={styles.card}>
        {steps.map((step) => (
          <View key={step.key} style={styles.row}>
            <Text style={styles.status}>{statusLabel(step.status)}</Text>
            <View style={styles.copyWrap}>
              <Text style={styles.label}>{step.label}</Text>
              {step.detail ? <Text style={styles.detail}>{step.detail}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

async function loginAs(email: string, password: string, role?: "MEMBER" | "TRAINER" | "ADMIN") {
  const session = await loginApi({ email, password, tenantSlug: TENANT_SLUG, role, e2e: true });
  if (!session.accessToken) throw new Error(`${email} oturum tokeni alınamadı`);
  setAuthToken(session.accessToken);
  return session;
}

async function verifyMultiPersonaRouting() {
  const member = await loginAs(MULTI_EMAIL, MULTI_PASSWORD, "MEMBER");
  if (member.user?.role !== "MEMBER" || member.recommended_entry_surface !== "MEMBER_HOME") {
    throw new Error("Multi-persona MEMBER yüzeyi doğru çözülmedi");
  }

  const trainer = await loginAs(MULTI_EMAIL, MULTI_PASSWORD, "TRAINER");
  if (trainer.user?.role !== "TRAINER" || trainer.recommended_entry_surface !== "TRAINER_HOME") {
    throw new Error("Multi-persona TRAINER yüzeyi doğru çözülmedi");
  }

  const admin = await loginAs(MULTI_EMAIL, MULTI_PASSWORD, "ADMIN");
  if (admin.user?.role !== "ADMIN" || admin.recommended_entry_surface !== "ADMIN_HOME") {
    throw new Error("Multi-persona ADMIN yüzeyi doğru çözülmedi");
  }
}

async function findTrainer() {
  const trainers = await getAdminTrainersApi();
  const trainer = trainers.find((row) => String(row.email || "").toLowerCase() === TRAINER_EMAIL) || trainers[0];
  if (!trainer?.id) throw new Error("Edge-case testi için eğitmen bulunamadı");
  return trainer;
}

async function ensurePackage(title: string, mode: "PRIVATE" | "GROUP" | "DUO", capacity: number, trainerId: string) {
  const existing = (await getAdminPackagesApi()).find((row) => row.title === title);
  const pkg =
    existing ||
    (await createAdminPackageApi({
      title,
      total_credits: mode === "DUO" ? 8 : 4,
      duration_days: 30,
      is_active: true,
      is_visible: true,
      is_public: true,
      service_key: mode === "GROUP" ? "GROUP" : mode === "DUO" ? "DUO_TRAINING" : "PT",
      display_price: mode === "GROUP" ? 900 : mode === "DUO" ? 2600 : 1800,
      trainer_commission_rate: 30,
      capacity,
      summary: `${mode} release edge-case paketi`,
      lesson_mode: mode,
      sub_lessons: mode === "GROUP" ? ["Pilates Edge"] : undefined,
      session_duration_minutes: 50,
      break_duration_minutes: 10,
    }));

  const assignments = await getAdminPackageAssignmentsApi({ package_id: pkg.id });
  if (!assignments.some((row) => String(row.package_id) === String(pkg.id) && String(row.trainer_id) === String(trainerId))) {
    await createAdminPackageAssignmentApi({ package_id: pkg.id, trainer_id: trainerId });
  }
  return pkg;
}

async function verifyPaymentPendingAndReject(pkg: AdminPackage, trainerId: string) {
  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const request = await createPurchaseRequest(pkg, trainerId, { note: "reject-edge" });
  const pending = (await getMemberPaymentRequestsApi()).find((row) => row.id === request.id);
  if (pending?.status !== "PENDING") throw new Error("Ödeme talebi bekliyor durumunda görünmedi");

  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const approval = await waitForApproval((item) => item.type === "PAYMENT" && String(item.id).includes(request.id));
  await approveAdminMobileItemApi(approval.id, "REJECT");

  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const rejected = (await getMemberPaymentRequestsApi()).find((row) => row.id === request.id);
  if (rejected?.status !== "REJECTED") throw new Error("Reddedilen ödeme talebi üye tarafında görünmedi");
}

async function verifySecondPackagePurchase(pkg: AdminPackage, trainerId: string) {
  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const before = await getMemberMyPackagesApi();
  const request = await createPurchaseRequest(pkg, trainerId, { note: "second-package-edge" });

  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const approval = await waitForApproval((item) => item.type === "PAYMENT" && String(item.id).includes(request.id));
  await approveAdminMobileItemApi(approval.id, "APPROVE");

  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const after = await retry(() => getMemberMyPackagesApi());
  const hasNewPackage = after.some((row: any) => String(row.package_title || "") === pkg.title);
  if (!hasNewPackage || after.length <= before.length) throw new Error("Aktif üyeye ikinci paket eklenmedi");
}

async function verifyPackageModes(input: { privatePackage: AdminPackage; groupPackage: AdminPackage; duoPackage: AdminPackage; trainerId: string }) {
  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const privateRequest = await createPurchaseRequest(input.privatePackage, input.trainerId, { note: "private-mode-edge" });
  if (!privateRequest.id || (privateRequest as any).duo_payment) throw new Error("Özel paket talebi beklenen formatta değil");

  const groupRequest = await createPurchaseRequest(input.groupPackage, input.trainerId, {
    note: "group-mode-edge",
    selectedSubLesson: "Pilates Edge",
  });
  if (!groupRequest.id || Number(groupRequest.amount || 0) <= 0) throw new Error("Grup paket talebi beklenen formatta değil");

  const duoRequest = await createPurchaseRequest(input.duoPackage, input.trainerId, {
    note: "duo-mode-edge",
    duoPartnerName: "Edge Partner",
    duoPartnerContact: `edge.partner.${Date.now()}@demo.local`,
  });
  if (String((duoRequest as any).duo_payment?.status || "") !== "AWAITING_PARTNER_PAYMENT") {
    throw new Error("Duo paket ödeme ayrımı beklenen durumda değil");
  }
}

async function verifyApiErrorCopy(pkg: AdminPackage, trainerId: string) {
  try {
    await createPurchaseRequest(pkg, trainerId, { tenantSlug: "olmayan-salon" });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "SALON_NOT_FOUND" && error.message.includes("Salon bulunamadı")) {
      return;
    }
    throw error;
  }
  throw new Error("Geçersiz salon için API hata mesajı üretilmedi");
}

async function createPurchaseRequest(
  pkg: AdminPackage,
  trainerId: string,
  options: {
    note?: string;
    selectedSubLesson?: string;
    duoPartnerName?: string;
    duoPartnerContact?: string;
    tenantSlug?: string;
  } = {}
) {
  const startsAt = new Date(Date.UTC(2026, 4, 20 + Math.floor(Math.random() * 6), 9, 0, 0)).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
  const selectedDay = {
    starts_at: startsAt,
    ends_at: endsAt,
    label: "E2E Edge 09:00",
    package_id: pkg.id,
    package_title: pkg.title,
  };
  return createMemberPaymentRequestApi({
    tenant_slug: options.tenantSlug || TENANT_SLUG,
    package_id: pkg.id,
    package_ids: [pkg.id],
    trainer_id: trainerId,
    selected_sub_lesson: options.selectedSubLesson,
    duo_partner_name: options.duoPartnerName,
    duo_partner_contact: options.duoPartnerContact,
    note: options.note,
    selected_days: [selectedDay],
    selected_packages: [
      {
        package_id: pkg.id,
        package_title: pkg.title,
        package_price: pkg.display_price,
        preferred_slots: [selectedDay],
        weekly_frequency: 1,
        duo_partner_name: options.duoPartnerName,
        duo_partner_contact: options.duoPartnerContact,
      },
    ],
  });
}

async function waitForApproval(predicate: (item: any) => boolean) {
  return retry(async () => {
    const approvals = await getAdminMobileApprovalsApi();
    const match = approvals.find(predicate);
    if (!match) throw new Error("Beklenen ödeme onayı bulunamadı");
    return match;
  });
}

async function retry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tekrar deneme başarısız");
}

function statusLabel(status: StepStatus) {
  if (status === "passed") return "Geçti";
  if (status === "failed") return "Hata";
  if (status === "running") return "Çalışıyor";
  return "Bekliyor";
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    lineHeight: tokens.lineHeight.relaxed,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  status: {
    minWidth: 70,
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  detail: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  errorText: {
    color: tokens.colors.danger,
    textAlign: "center",
  },
  successText: {
    color: tokens.colors.success,
  },
});
