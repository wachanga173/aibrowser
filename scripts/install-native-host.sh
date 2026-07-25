#!/bin/bash
# Native Messaging Host Registration Script for Linux & macOS

HOST_NAME="com.privacy_ai.native_host"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BINARY_PATH="${SCRIPT_DIR}/../native-host/target/release/native_host_binary"
MANIFEST_FILE="${SCRIPT_DIR}/../native-host/com.privacy_ai.native_host.json"

cat <<EOF > "$MANIFEST_FILE"
{
  "name": "$HOST_NAME",
  "description": "Privacy AI Guard Native Companion Host",
  "path": "$BINARY_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*/"
  ]
}
EOF

# Chrome & Firefox Native Host destination paths
CHROME_TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
FIREFOX_TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"

mkdir -p "$CHROME_TARGET_DIR"
mkdir -p "$FIREFOX_TARGET_DIR"

cp "$MANIFEST_FILE" "$CHROME_TARGET_DIR/$HOST_NAME.json"
cp "$MANIFEST_FILE" "$FIREFOX_TARGET_DIR/$HOST_NAME.json"

echo "✅ Registered $HOST_NAME Native Messaging Host for Chrome and Firefox."
