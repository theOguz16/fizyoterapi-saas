#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
EMAIL="${E2E_CLINIC_OWNER_EMAIL:-clinic.owner.e2e@demo.local}"
PASSWORD="${E2E_CLINIC_OWNER_PASSWORD:-clinic-owner123}"

token=$(curl -fsS -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | node -e 'let body=""; process.stdin.on("data", (part) => body += part).on("end", () => process.stdout.write(JSON.parse(body).data.accessToken))')

curl -fsS -X POST "$API_BASE/account/clinic-request" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data '{"clinic_name":"Rol Degisimi E2E Klinik","city":"Istanbul","district":"Kadikoy","phone":"05550009966","about_text":"Rol degisimi ve cikis testi","owner_is_practitioner":true}' \
  >/dev/null
