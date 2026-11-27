#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DST_DIR="${HOME}/.gemini/config/plugins/agy-file-hub"

echo "Installing Antigravity File Hub -> ${DST_DIR}"
mkdir -p "${DST_DIR}"
for item in plugin.json package.json README.md README_EN.md LICENSE assets rules skills sidecars lib ui; do
  if [ -e "${SRC_DIR}/${item}" ]; then
    cp -R "${SRC_DIR}/${item}" "${DST_DIR}/"
  fi
done
echo "Installed successfully! Enable 'Antigravity File Hub' in Antigravity Customizations."
