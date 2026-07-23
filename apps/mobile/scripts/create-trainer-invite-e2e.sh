#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-oguzhanuyar531@gmail.com}"
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin123}"
TRAINER_EMAIL="${E2E_TRAINER_INVITE_EMAIL:-trainer.registration.e2e@demo.local}"

token=$(curl -fsS -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | node -e 'let body=""; process.stdin.on("data", (part) => body += part).on("end", () => process.stdout.write(JSON.parse(body).data.accessToken))')

curl -fsS -X POST "$API_BASE/admin/invites" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "{\"role\":\"TRAINER\",\"email_or_phone\":\"$TRAINER_EMAIL\",\"expires_in_hours\":24,\"note\":\"Maestro trainer invite E2E\"}" \
  | node -e 'let body=""; process.stdin.on("data", (part) => body += part).on("end", () => process.stdout.write(JSON.parse(body).data.invite_token))'
