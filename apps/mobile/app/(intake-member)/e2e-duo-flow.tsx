import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  approveAdminMobileItemApi,
  createAdminPackageApi,
  createAdminPackageAssignmentApi,
  createMemberPaymentRequestApi,
  getAdminBookingsApi,
  getAdminMobileApprovalsApi,
  getAdminPackageAssignmentsApi,
  getAdminPackagesApi,
  getAdminTrainersApi,
  getMemberBookingsApi,
  getMemberMyPackagesApi,
  getTrainerBookingsApi,
  inviteAcceptApi,
  invitePreviewApi,
  loginApi,
} from "@/lib/mobile-api";
import { setAuthToken } from "@/lib/http-client";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { tokens } from "@/theme/tokens";

const ADMIN_EMAIL = "oguzhanuyar531@gmail.com";
const ADMIN_PASSWORD = "admin123";
const MEMBER_EMAIL = "member@gmail.com";
const MEMBER_PASSWORD = "member123";
const TRAINER_EMAIL = "elisauyar@gmail.com";
const TRAINER_PASSWORD = "trainer123";
const TENANT_SLUG = "demo-salon";
const PACKAGE_TITLE = "E2E Duo Maestro Paketi";

type StepStatus = "pending" | "running" | "passed" | "failed";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

export default function E2EDuoFlowScreen() {
  const [steps, setSteps] = useState<Step[]>([
    { key: "setup", label: "Duo paket ve eğitmen bağlantısı", status: "pending" },
    { key: "newPartner", label: "Yeni partner kayıt daveti", status: "pending" },
    { key: "existingPartner", label: "Mevcut hesapla davet kabulü", status: "pending" },
    { key: "calendars", label: "Üye, eğitmen ve admin takvim doğrulaması", status: "pending" },
  ]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const summary = useMemo(() => {
    if (error) return "Duo Maestro senaryosu hata aldı";
    if (done) return "Duo Maestro senaryosu geçti";
    return "Duo Maestro senaryosu çalışıyor";
  }, [done, error]);

  useEffect(() => {
    if (!isE2EModeEnabled()) return;
    let cancelled = false;

    const updateStep = (key: string, status: StepStatus, detail?: string) => {
      if (cancelled) return;
      setSteps((current) =>
        current.map((step) => (step.key === key ? { ...step, status, detail } : step))
      );
    };

    async function run() {
      try {
        updateStep("setup", "running");
        const { packageId, trainerId } = await ensureDuoPackage();
        updateStep("setup", "passed", PACKAGE_TITLE);

        updateStep("newPartner", "running");
        const newPartnerEmail = `duo.partner.${Date.now()}@demo.local`;
        await runDuoScenario({
          packageId,
          trainerId,
          partnerName: "Yeni Partner",
          partnerContact: newPartnerEmail,
          acceptPayload: {
            first_name: "Yeni",
            last_name: "Partner",
            phone: "05551234999",
            password: "partner123",
          },
        });
        updateStep("newPartner", "passed", newPartnerEmail);

        updateStep("existingPartner", "running");
        await runDuoScenario({
          packageId,
          trainerId,
          partnerName: "Test Bir",
          partnerContact: "test1.user@demo.local",
          acceptPayload: {
            first_name: "Test",
            last_name: "Bir",
            password: "member123",
          },
        });
        updateStep("existingPartner", "passed", "test1.user@demo.local");

        updateStep("calendars", "running");
        await verifyCalendars();
        updateStep("calendars", "passed", "Duo ders takvimlerde görünüyor");

        if (!cancelled) setDone(true);
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "Bilinmeyen hata";
        if (!cancelled) {
          setError(message);
          setSteps((current) =>
            current.map((step) => (step.status === "running" ? { ...step, status: "failed", detail: message } : step))
          );
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

async function loginAs(email: string, password: string) {
  const session = await loginApi({ email, password, tenantSlug: TENANT_SLUG, e2e: true });
  if (!session.accessToken) throw new Error(`${email} oturum tokeni alınamadı`);
  setAuthToken(session.accessToken);
  return session;
}

async function ensureDuoPackage() {
  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const trainers = await getAdminTrainersApi();
  const trainer = trainers.find((row) => String(row.email || "").toLowerCase() === TRAINER_EMAIL) || trainers[0];
  if (!trainer?.id) throw new Error("Duo testi için eğitmen bulunamadı");

  const packages = await getAdminPackagesApi();
  let duoPackage = packages.find((row) => row.title === PACKAGE_TITLE && row.is_active !== false);
  if (!duoPackage) {
    duoPackage = await createAdminPackageApi({
      title: PACKAGE_TITLE,
      total_credits: 8,
      duration_days: 30,
      is_active: true,
      is_visible: true,
      is_public: true,
      service_key: "DUO_TRAINING",
      display_price: 2600,
      trainer_commission_rate: 30,
      capacity: 2,
      summary: "Maestro duo uçtan uca test paketi",
      lesson_mode: "DUO",
      session_duration_minutes: 50,
      break_duration_minutes: 10,
    });
  }
  if (!duoPackage?.id) throw new Error("Duo paketi oluşturulamadı");

  const assignments = await getAdminPackageAssignmentsApi({ package_id: duoPackage.id });
  const hasAssignment = assignments.some(
    (row) => String(row.package_id) === String(duoPackage.id) && String(row.trainer_id) === String(trainer.id)
  );
  if (!hasAssignment) {
    await createAdminPackageAssignmentApi({ package_id: duoPackage.id, trainer_id: String(trainer.id) });
  }

  return { packageId: String(duoPackage.id), trainerId: String(trainer.id) };
}

async function runDuoScenario(input: {
  packageId: string;
  trainerId: string;
  partnerName: string;
  partnerContact: string;
  acceptPayload: {
    first_name: string;
    last_name: string;
    phone?: string;
    password: string;
  };
}) {
  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  await createMemberPaymentRequestApi({
    tenant_slug: TENANT_SLUG,
    package_id: input.packageId,
    package_ids: [input.packageId],
    trainer_id: input.trainerId,
    duo_partner_name: input.partnerName,
    duo_partner_contact: input.partnerContact,
    selected_days: [
      {
        starts_at: "2026-05-18T09:00:00.000Z",
        ends_at: "2026-05-18T10:00:00.000Z",
        label: "Pazartesi 09:00",
        package_id: input.packageId,
        package_title: PACKAGE_TITLE,
      },
    ],
    selected_packages: [
      {
        package_id: input.packageId,
        package_title: PACKAGE_TITLE,
        package_price: 2600,
        preferred_slots: [
          {
            starts_at: "2026-05-18T09:00:00.000Z",
            ends_at: "2026-05-18T10:00:00.000Z",
            label: "Pazartesi 09:00",
            package_id: input.packageId,
            package_title: PACKAGE_TITLE,
          },
        ],
        weekly_frequency: 1,
        duo_partner_name: input.partnerName,
        duo_partner_contact: input.partnerContact,
      },
    ],
  });

  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const primaryApproval = await waitForApproval((item) => {
    return (
      item.type === "PAYMENT" &&
      item.is_duo === true &&
      item.request_type !== "DUO_PARTNER_PAYMENT" &&
      String(item.duo_partner_contact || "").toLowerCase() === input.partnerContact.toLowerCase()
    );
  });
  await approveAdminMobileItemApi(primaryApproval.id, "APPROVE");

  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const ownedPackages = await waitForMemberPackage(input.partnerContact);
  const inviteToken = String(ownedPackages.duo_invite_token || "");
  if (!inviteToken) throw new Error("Duo partner davet tokeni üye paketinde görünmedi");
  const preview = await invitePreviewApi(inviteToken);
  if (String((preview as any)?.kind || "").toUpperCase() !== "DUO_PARTNER") {
    throw new Error("Duo invite preview beklenen türde değil");
  }

  await inviteAcceptApi({
    token: inviteToken,
    first_name: input.acceptPayload.first_name,
    last_name: input.acceptPayload.last_name,
    phone: input.acceptPayload.phone || "",
    password: input.acceptPayload.password,
  });

  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const partnerApproval = await waitForApproval((item) => {
    return (
      item.type === "PAYMENT" &&
      item.is_duo === true &&
      item.request_type === "DUO_PARTNER_PAYMENT" &&
      String(item.duo_partner_contact || "").toLowerCase() === input.partnerContact.toLowerCase()
    );
  });
  await approveAdminMobileItemApi(partnerApproval.id, "APPROVE");
}

async function waitForApproval(predicate: (item: any) => boolean) {
  return retry(async () => {
    const approvals = await getAdminMobileApprovalsApi();
    const match = approvals.find(predicate);
    if (!match) throw new Error("Beklenen duo admin onayı bulunamadı");
    return match;
  });
}

async function waitForMemberPackage(partnerContact: string) {
  return retry(async () => {
    const packages = await getMemberMyPackagesApi();
    const match = packages.find(
      (row: any) =>
        row.is_duo === true &&
        String(row.package_title || "") === PACKAGE_TITLE &&
        String(row.duo_partner_contact || "").toLowerCase() === partnerContact.toLowerCase()
    );
    if (!match) throw new Error("Duo paket üye tarafında görünmedi");
    return match as any;
  });
}

async function verifyCalendars() {
  await loginAs(MEMBER_EMAIL, MEMBER_PASSWORD);
  const memberBookings = await getMemberBookingsApi();
  const memberHasDuo = readRows(memberBookings).some((row: any) => row.is_duo || row.lesson_mode === "DUO" || row.duo_status);
  if (!memberHasDuo) throw new Error("Member takviminde duo booking görünmedi");

  await loginAs(TRAINER_EMAIL, TRAINER_PASSWORD);
  const trainerBookings = await getTrainerBookingsApi();
  const trainerHasDuo = readRows(trainerBookings).some((row: any) => row.is_duo || row.lesson_mode === "DUO" || row.duo_status);
  if (!trainerHasDuo) throw new Error("Trainer takviminde duo booking görünmedi");

  await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminBookings = await getAdminBookingsApi();
  const adminHasDuo = readRows(adminBookings).some((row: any) => row.is_duo || row.lesson_mode === "DUO" || row.duo_status);
  if (!adminHasDuo) throw new Error("Admin takviminde duo booking görünmedi");
}

function readRows(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function retry<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400));
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
    justifyContent: "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  card: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  status: {
    minWidth: 70,
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  copyWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  detail: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  successText: {
    color: tokens.colors.success,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },
});
