#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
MAESTRO_BIN="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"
FLOW_DIR="$ROOT_DIR/apps/mobile/tests/e2e/maestro"
OUTPUT_DIR="$ROOT_DIR/apps/web/public/product-screens"

if ! curl -fsS http://127.0.0.1:4949/health >/dev/null; then
  echo "Fizyoflow API 4949 portunda çalışmıyor. Önce pnpm reset:api ve pnpm dev:api çalıştırın." >&2
  exit 1
fi

if [[ ! -x "$MAESTRO_BIN" ]]; then
  echo "Maestro bulunamadı: $MAESTRO_BIN" >&2
  exit 1
fi

if [[ -z "$(xcrun simctl list devices booted | grep -E 'iPhone|iPad')" ]]; then
  echo "Boot edilmiş bir iOS simülatörü bulunamadı." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

for flow in \
  marketing-admin-screenshots.yaml \
  marketing-trainer-screenshots.yaml \
  marketing-member-screenshots.yaml; do
  echo "Çekiliyor: $flow"
  "$MAESTRO_BIN" test "$FLOW_DIR/$flow"
done

expected=(
  admin-dashboard admin-calendar admin-members admin-member-detail admin-trainer-detail
  admin-packages admin-revenue-detail admin-campaigns
  trainer-home trainer-today trainer-checkin trainer-client-detail trainer-group-classes
  trainer-qr trainer-profile
  member-home member-booking-detail member-package member-measurements
  member-measurement-history member-progress member-qr member-referrals member-profile
)

missing=()
for name in "${expected[@]}"; do
  [[ -f "$OUTPUT_DIR/$name.png" ]] || missing+=("$name.png")
done

if (( ${#missing[@]} > 0 )); then
  echo "Eksik ekran görüntüleri: ${missing[*]}" >&2
  exit 1
fi

echo "Ürün ekranları hazır: $OUTPUT_DIR"
