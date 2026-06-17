#!/usr/bin/env bash
# Lightweight auto-deploy to Cloudflare Pages
# Called by post-commit hook and can be run manually
# IMPORTANT: Uses a temp build dir so the server .next/ is never corrupted
set -euo pipefail
cd /home/jupiter/TravelBoard

source .env

# Get tunnel URL
TUNNEL_URL=$(pm2 logs travelboard-tunnel --lines 30 --nostream 2>&1 | grep -oP 'https://[a-z-]+\.trycloudflare\.com' | tail -1)
TUNNEL_URL="${TUNNEL_URL:-https://documented-runtime-workflow-friends.trycloudflare.com}"

echo "$(date) — Deploying to Cloudflare Pages (API: $TUNNEL_URL)"

# Build static in a temp directory to avoid corrupting the server .next/
TMPDIR=$(mktemp -d)
DEPLOY_DIR="$TMPDIR/travelboard-deploy"

# Copy source (excluding .next, node_modules, .git)
rsync -a --exclude='.next' --exclude='node_modules' --exclude='.git' --exclude='out' . "$DEPLOY_DIR/"

# Symlink node_modules to avoid reinstalling
ln -s /home/jupiter/TravelBoard/node_modules "$DEPLOY_DIR/node_modules"

# Remove API routes for static build
rm -rf "$DEPLOY_DIR/src/app/api"
mkdir -p "$DEPLOY_DIR/src/app/api"

# Build static in temp dir
cd "$DEPLOY_DIR"
STATIC_EXPORT=1 NEXT_PUBLIC_API_URL="$TUNNEL_URL" npx next build 2>&1

# Deploy from temp dir
cd /home/jupiter/TravelBoard
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
export CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy "$DEPLOY_DIR/out/" --project-name travelboard --branch main --commit-dirty=true 2>&1

# Cleanup
rm -rf "$TMPDIR"

# Rebuild server version so PM2 has clean .next
npm run build 2>&1
pm2 restart travelboard 2>/dev/null

echo "$(date) — Deploy complete: https://travelboard-9q0.pages.dev"
