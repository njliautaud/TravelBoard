#!/usr/bin/env bash
# cap-build.sh — Build static export for Capacitor and sync native projects
#
# This temporarily adds `output: 'export'` to next.config.ts, runs the build,
# syncs the resulting `out/` directory into the iOS and Android Capacitor
# projects, then restores the original config so the PM2 server deployment
# (which needs SSR mode) is unaffected.
#
# Usage:
#   ./scripts/cap-build.sh            # build + sync both platforms
#   ./scripts/cap-build.sh android    # sync android only
#   ./scripts/cap-build.sh ios        # sync ios only

set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM="${1:-}"
CONFIG="next.config.ts"
BACKUP="next.config.ts.bak"

cleanup() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$CONFIG"
    echo "Restored original $CONFIG"
  fi
}
trap cleanup EXIT

# 1. Back up the original config
cp "$CONFIG" "$BACKUP"

# 2. Inject output: 'export' into the Next.js config
#    We insert it right after the opening of nextConfig
sed -i "s/const nextConfig: NextConfig = {/const nextConfig: NextConfig = {\n  output: 'export',/" "$CONFIG"

echo "Building Next.js static export..."
npx next build

# 3. Remove the server.url from capacitor.config.ts for production sync
#    (The static files in out/ are the production bundle; server.url is dev-only.)
#    We don't modify the config — Capacitor copies out/ regardless of server.url.

# 4. Sync with Capacitor
if [ -z "$PLATFORM" ]; then
  echo "Syncing both platforms..."
  npx cap sync
elif [ "$PLATFORM" = "android" ]; then
  echo "Syncing Android..."
  npx cap sync android
elif [ "$PLATFORM" = "ios" ]; then
  echo "Syncing iOS..."
  npx cap sync ios
else
  echo "Unknown platform: $PLATFORM (use 'android' or 'ios')"
  exit 1
fi

echo ""
echo "Capacitor build complete."
echo "  - Android: open in Android Studio with 'npx cap open android'"
echo "  - iOS:     open in Xcode with 'npx cap open ios' (macOS only)"
