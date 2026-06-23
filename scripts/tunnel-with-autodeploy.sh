#!/usr/bin/env bash
# Starts a Cloudflare quick tunnel and auto-updates the Worker proxy when URL changes.
# The frontend NEVER needs rebuilding — it always calls the permanent Worker URL:
#   https://travelboard-api.relentlessrobotics.workers.dev
# This script only updates the Worker's TUNNEL_URL env var via API.
set -euo pipefail

LOGFILE="/home/jupiter/TravelBoard/logs/tunnel-autodeploy.log"
URL_FILE="/home/jupiter/TravelBoard/.tunnel-url"
UPDATE_SCRIPT="/home/jupiter/TravelBoard/scripts/update-worker-tunnel-url.sh"
mkdir -p /home/jupiter/TravelBoard/logs

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOGFILE"; }

log "Starting tunnel (Worker proxy mode — no frontend rebuild needed)..."

# Start cloudflared quick tunnel, capture output
cloudflared tunnel --url http://localhost:3000 2>&1 | while IFS= read -r line; do
  echo "$line"  # Pass through to PM2 logs

  # Capture the tunnel URL
  if echo "$line" | grep -qoP 'https://[a-z0-9-]+\.trycloudflare\.com'; then
    NEW_URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
    OLD_URL=""
    [ -f "$URL_FILE" ] && OLD_URL=$(cat "$URL_FILE")

    if [ "$NEW_URL" != "$OLD_URL" ]; then
      echo "$NEW_URL" > "$URL_FILE"
      log "New tunnel URL: $NEW_URL (was: $OLD_URL)"

      # Update the Worker's TUNNEL_URL — takes ~2 seconds, no rebuild
      (
        sleep 2  # Let tunnel fully establish
        bash "$UPDATE_SCRIPT" "$NEW_URL" >> "$LOGFILE" 2>&1 && \
          log "Worker proxy updated — no frontend rebuild needed" || \
          log "Worker update FAILED (exit $?)"
      ) &
    fi
  fi
done
