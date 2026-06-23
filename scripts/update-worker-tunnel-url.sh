#!/usr/bin/env bash
# Updates the Cloudflare Worker's TUNNEL_URL env var when the tunnel URL changes.
# Called by the tunnel script on restart. No frontend rebuild needed.
set -euo pipefail

source /home/jupiter/TravelBoard/.env

NEW_URL="${1:?Usage: $0 <new-tunnel-url>}"

WORKER_SCRIPT="/home/jupiter/TravelBoard/scripts/worker-proxy.js"
METADATA='{"main_module":"worker-proxy.js","bindings":[{"type":"plain_text","name":"TUNNEL_URL","text":"'"$NEW_URL"'"}],"compatibility_date":"2024-01-01"}'

curl -sf -X PUT "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/travelboard-api" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -F "worker-proxy.js=@$WORKER_SCRIPT;type=application/javascript+module" \
  -F "metadata=$METADATA;type=application/json" > /dev/null

echo "$(date) — Worker TUNNEL_URL updated to $NEW_URL"
