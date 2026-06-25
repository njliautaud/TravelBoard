#!/bin/bash
# Run cloudflared quick tunnel for TravelBoard
# PM2 will keep this alive
exec cloudflared tunnel --url http://localhost:3000
