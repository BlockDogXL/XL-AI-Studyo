#!/usr/bin/env bash
# XL AI Studyo - tasinabilir Python kurulumu (Linux / macOS).
# Python'u sisteme degil, ext/runtime/python/ klasorune kurar.
set -euo pipefail

SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(dirname "$SETUP_DIR")"
TARGET="$EXT_DIR/runtime/python"
CONFIG="$SETUP_DIR/python-version.json"

if [ -x "$TARGET/bin/python3" ]; then
  echo "  [OK] Tasinabilir Python zaten kurulu: $("$TARGET/bin/python3" --version)"
  exit 0
fi

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  KEY="linux-x86_64" ;;
  Darwin-arm64)  KEY="macos-arm64" ;;
  *) echo "  [HATA] Bu platform icin hazir Python paketi yok: $(uname -s) $(uname -m)"; exit 1 ;;
esac

# python-version.json icinden "KEY": { "url": ..., "sha256": ... } blogunu oku.
read_field() {
  awk -v key="\"$KEY\"" -v field="\"$1\"" '
    index($0, key) { inside = 1; next }
    inside && index($0, field) { sub(/^[^:]*: *"/, ""); sub(/".*$/, ""); print; exit }
    inside && /}/ { exit }
  ' "$CONFIG"
}
URL="$(read_field url)"
SHA="$(read_field sha256)"
if [ -z "$URL" ] || [ -z "$SHA" ]; then
  echo "  [HATA] $CONFIG icinde $KEY bilgisi okunamadi."; exit 1
fi

TMP_FILE="$EXT_DIR/runtime/python-download.tar.gz.part"
mkdir -p "$EXT_DIR/runtime"
echo "  [INFO] Tasinabilir Python indiriliyor ($KEY)..."
curl -fL --retry 3 -o "$TMP_FILE" "$URL"

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$TMP_FILE" | awk '{print $1}')"
else
  ACTUAL="$(shasum -a 256 "$TMP_FILE" | awk '{print $1}')"
fi
if [ "$ACTUAL" != "$SHA" ]; then
  rm -f "$TMP_FILE"
  echo "  [HATA] SHA-256 uyusmadi. Beklenen $SHA, gelen $ACTUAL"; exit 1
fi

rm -rf "$TARGET.tmp"
mkdir -p "$TARGET.tmp"
tar -xzf "$TMP_FILE" -C "$TARGET.tmp"
# Paket "python/" klasoru icinde gelir.
mv "$TARGET.tmp/python" "$TARGET"
rm -rf "$TARGET.tmp" "$TMP_FILE"
echo "  [OK] Tasinabilir Python kuruldu: $("$TARGET/bin/python3" --version)"
