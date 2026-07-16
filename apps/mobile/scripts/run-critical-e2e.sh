#!/bin/sh
set -eu

# Geriye donuk uyumluluk: eski "critical" komutu artik rol bazli release
# matrisinin tamamini calistirir.
exec sh scripts/run-role-matrix-e2e.sh "$@"
