#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
EMAIL="${E2E_CLINIC_OWNER_EMAIL:-clinic.owner.e2e@demo.local}"
PASSWORD="${E2E_CLINIC_OWNER_PASSWORD:-clinic-owner123}"
CLINIC_NAME="${E2E_CLINIC_NAME:-E2E Klinik Aktivasyon}"
PACKAGE_TITLE="${E2E_PACKAGE_TITLE:-Aktivasyon E2E Paket}"

token=$(curl -fsS -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | node -e 'let body=""; process.stdin.on("data", (part) => body += part).on("end", () => process.stdout.write(JSON.parse(body).data.accessToken))')

request() {
  curl -fsS "$API_BASE$1" \
    -H "Authorization: Bearer $token" \
    -H 'X-FizyoFlow-Response-Envelope: 1'
}

clinic=$(request '/account/clinic-request')
packages=$(request '/admin/packages')
settings=$(request '/admin/settings')
qr=$(request '/admin/clinic/qr')
subscription=$(request '/admin/clinic/subscription')

CLINIC="$clinic" PACKAGES="$packages" SETTINGS="$settings" QR="$qr" SUBSCRIPTION="$subscription" CLINIC_NAME="$CLINIC_NAME" PACKAGE_TITLE="$PACKAGE_TITLE" node <<'NODE'
const fail = (message) => {
  console.error(`Klinik aktivasyon API doğrulaması başarısız: ${message}`);
  process.exit(1);
};
const clinic = JSON.parse(process.env.CLINIC).data;
const packages = JSON.parse(process.env.PACKAGES).data;
const settings = JSON.parse(process.env.SETTINGS).data;
const qr = JSON.parse(process.env.QR).data;
const subscription = JSON.parse(process.env.SUBSCRIPTION).data;

if (clinic?.name !== process.env.CLINIC_NAME || clinic?.city !== "İstanbul" || clinic?.district !== "Kadıköy") fail("1/4 klinik bilgileri bulunamadı.");
if (!Array.isArray(packages) || !packages.some((item) => item.title === process.env.PACKAGE_TITLE)) fail("2/4 ilk paket kaydı bulunamadı.");
const hours = settings?.profile?.business_hours;
if (hours?.start_time !== "09:00" || hours?.end_time !== "18:00" || ![1, 2, 3, 4, 5].every((day) => hours?.working_days?.includes(day))) fail("3/4 çalışma saatleri kaydı bulunamadı.");
if (!qr?.qr_code || !qr?.qr_payload || !qr?.join_url) fail("4/4 klinik QR kaydı bulunamadı.");
if (!subscription?.subscription_status) fail("Plan sayfasının abonelik verisi bulunamadı.");

console.log(JSON.stringify({
  clinic: clinic.name,
  package: process.env.PACKAGE_TITLE,
  working_hours: `${hours.start_time}-${hours.end_time}`,
  qr: "ready",
  subscription_status: subscription.subscription_status,
}));
NODE
