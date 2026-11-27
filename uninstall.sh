#!/usr/bin/env bash
set -euo pipefail
DST_DIR="${HOME}/.gemini/config/plugins/agy-file-hub"
if [ -d "${DST_DIR}" ]; then
  rm -rf "${DST_DIR}"
  echo "Uninstalled Antigravity File Hub from ${DST_DIR}"
else
  echo "Antigravity File Hub is not installed at ${DST_DIR}"
fi
