#!/usr/bin/env bash
set -euo pipefail

# Run on macOS after building an unsigned iPhoneOS IPA.
IPA_PATH="$1"
EXPECTED_VERSION="$2"
EXPECTED_BUNDLE="StiriRO.app"
EXPECTED_BINARY="StiriRO"

test -f "$IPA_PATH" || { echo "IPA missing: $IPA_PATH" >&2; exit 1; }
/usr/bin/unzip -t "$IPA_PATH" >/dev/null

# Confirm the paths Sideloadly will look for, not just ZIP integrity.
if ! /usr/bin/unzip -Z -1 "$IPA_PATH" | grep -Fqx "Payload/$EXPECTED_BUNDLE/$EXPECTED_BINARY"; then
  echo "IPA missing main binary: Payload/$EXPECTED_BUNDLE/$EXPECTED_BINARY" >&2
  exit 1
fi
if ! /usr/bin/unzip -Z -1 "$IPA_PATH" | grep -Fqx "Payload/$EXPECTED_BUNDLE/Info.plist"; then
  echo "IPA missing main Info.plist" >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
/usr/bin/unzip -q "$IPA_PATH" -d "$TEMP_DIR"
APP_PATH="$TEMP_DIR/Payload/$EXPECTED_BUNDLE"
BINARY_PATH="$APP_PATH/$EXPECTED_BINARY"
test -f "$BINARY_PATH" || { echo "Main app binary not found" >&2; exit 1; }
test -x "$BINARY_PATH" || { echo "Main app binary is not executable" >&2; exit 1; }

PLIST_BINARY=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Info.plist")
PLIST_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Info.plist")
PLIST_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")
PLIST_DISPLAY=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$APP_PATH/Info.plist")
test "$PLIST_BINARY" = "$EXPECTED_BINARY" || { echo "CFBundleExecutable mismatch: $PLIST_BINARY" >&2; exit 1; }
test "$PLIST_VERSION" = "$EXPECTED_VERSION" || { echo "Version mismatch: $PLIST_VERSION" >&2; exit 1; }
test "$PLIST_ID" = "ro.stiriro.mobile" || { echo "Unexpected bundle ID: $PLIST_ID" >&2; exit 1; }
test "$PLIST_DISPLAY" = "Știri RO" || { echo "Unexpected display name: $PLIST_DISPLAY" >&2; exit 1; }
/usr/bin/file "$BINARY_PATH" | grep -q "Mach-O" || { echo "Not a Mach-O executable" >&2; exit 1; }
/usr/bin/lipo -archs "$BINARY_PATH" | grep -Eq '(^| )arm64( |$)' || {
  echo "arm64 architecture missing" >&2
  exit 1
}
echo "Valid IPA: $IPA_PATH"
echo "Binary: Payload/$EXPECTED_BUNDLE/$EXPECTED_BINARY, version: $PLIST_VERSION"
