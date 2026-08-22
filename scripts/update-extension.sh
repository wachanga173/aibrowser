#!/usr/bin/env bash
set -e

echo "===================================================="
echo "PRIVACY GUARD IN-PLACE EXTENSION AUTO-UPDATER"
echo "===================================================="
echo ""

REPO="wachanga173/aibrowser"
EXTENSION_DIR="$(pwd)/extension"
TEMP_ZIP="$(pwd)/temp_update.zip"

if command -v node >/dev/null 2>&1; then
    echo "Running Node.js in-place updater..."
    node scripts/update-in-place.js
    exit 0
fi

echo "Fetching latest release from GitHub..."
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/chrome-extension.zip"
curl -sL "${DOWNLOAD_URL}" -o "${TEMP_ZIP}"

echo "Extracting new files over extension directory: ${EXTENSION_DIR}..."
unzip -q -o "${TEMP_ZIP}" -d "${EXTENSION_DIR}"
rm -f "${TEMP_ZIP}"

echo "----------------------------------------------------"
echo "IN-PLACE UPDATE COMPLETE!"
echo "Old files replaced in-place. Temporary files deleted."
echo "Reload Privacy Guard in chrome://extensions."
echo "----------------------------------------------------"
