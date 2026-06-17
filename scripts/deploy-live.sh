#!/usr/bin/env bash
# Deploy TravelBoard to Cloudflare Pages (SOURCE OF TRUTH).
# Usage: bash scripts/deploy-live.sh
#
# Single destination: https://travelboard-9q0.pages.dev
# The tunnel (localhost:3000) serves as API backend ONLY, not a separate site.

set -euo pipefail
cd "$(dirname "$0")/.."

# Get current tunnel URL from PM2 logs
TUNNEL_URL=$(pm2 logs travelboard-tunnel --lines 30 --nostream 2>&1 | grep -oP 'https://[a-z-]+\.trycloudflare\.com' | tail -1)

if [ -z "$TUNNEL_URL" ]; then
  echo "WARNING: No tunnel URL found. Using fallback."
  TUNNEL_URL="https://documented-runtime-workflow-friends.trycloudflare.com"
fi

echo "==> Using API backend: $TUNNEL_URL"
echo "==> Building static export for Cloudflare Pages..."

# Remove API routes temporarily (they run on Jupiter backend, not static)
API_DIR="src/app/api"
BACKUP_DIR=".api-backup"
cp -r "$API_DIR" "$BACKUP_DIR"
rm -rf "$API_DIR"
mkdir -p "$API_DIR"

# Build with STATIC_EXPORT=1 to enable output: "export" in next.config.ts
STATIC_EXPORT=1 NEXT_PUBLIC_API_URL="$TUNNEL_URL" npx next build

# Restore API routes
rm -rf "$API_DIR"
mv "$BACKUP_DIR" "$API_DIR"

echo "==> Deploying to Cloudflare Pages (production)..."
# Cloudflare credentials from environment variables (set in .env, not hardcoded)
npx wrangler pages deploy out/ --project-name travelboard --branch main --commit-dirty=true

echo ""
echo "==> Done! Live at: https://travelboard-9q0.pages.dev"
