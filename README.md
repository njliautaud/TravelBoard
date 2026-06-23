# TravelBoard

Personal travel bucket list and journal on an interactive world map. Countries glow with your saved wishes; click to zoom in, read entries, and add places from Instagram reels via WhatsApp or the **Android share sheet**.

## Stack

- Next.js 15 (App Router, TypeScript) + Tailwind CSS 4
- MapLibre GL JS (Carto dark basemap, no API token)
- PostgreSQL 16 + Prisma ORM 6
- Nominatim (OpenStreetMap) geocoding
- Wikipedia / Wikimedia Commons + Serper.dev (Google Images) for cover photos, cached in Postgres
- WhatsApp Web.js bot for driving Claude Code from your phone (optional)
- Android WebView app with a native share target (see [`android/`](android/README.md))

## Getting started

```bash
npm install
cp .env.example .env        # edit secrets and keys

# PostgreSQL — Docker or local instance matching DATABASE_URL
docker compose up -d        # optional

npx prisma migrate deploy   # apply migrations
npm run dev                 # http://localhost:3000 (port 3000 pinned)
```

**Do not run `npx prisma db seed` if you already have your own places** — seed only loads demo data when your account is empty. To force a wipe and re-seed demo data: `TRAVELBOARD_SEED_RESET=1 npx prisma db seed`.

## Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Signs the httpOnly session cookie |
| `FLIGHT_API_KEY` | `X-API-Key` for `POST /api/flight-prices` |
| `WHATSAPP_INGEST_KEY` | Shared secret for draft ingest (`POST /api/drafts/ingest`) |
| `WHATSAPP_OWNER_USERNAME` | Owner username for drafts + ESP32 `/api/hardware-sync` scope (e.g. `swann`) |
| `CLAUDE_CHANNEL_SECRET` | Shared secret for the WhatsApp → Claude Code remote-control bot (must match in `.env`) |
| `SERPER_API_KEY` | [Serper.dev](https://serper.dev) key for Google-Images cover search (`/api/fetch-previews`); blank ⇒ placeholder images |

## Using the app

- **Accounts**: register / log in with username + password. Each user has their own map and wishlist.
- **Left sidebar**: dropdown for **Your wishes** (sorted by season / starred) and **Settings** (map theme, home airports).
- **Map themes** (Settings): **Classic** (amber glow) or **Flag colors** (each country uses its flag accent color). Hover/click borders also use flag colors.
- **Add places**: search OpenStreetMap, drop a pin, send an Instagram/TikTok link to yourself on WhatsApp, or share a link to the Android app.
- **Cover photos**: **Generate image** searches Google Images (Serper.dev), cached in Postgres so repeat/similar searches cost 0 API credits; **Regenerate** forces a fresh pull. Results route through `/api/cover-proxy` so they load reliably; play-button overlays on social thumbnails are stripped server-side.
- **Duplicate guard**: adding a wish that matches an existing one (same country + similar activity, across languages — e.g. *salar* ≈ *salt flat*) prompts before saving.
- **Details**: every wish has a **Details** button opening a full read-only view.
- **Country panel**: clicking a country opens its wishes in the right panel (and stays open while the map pans in). A country with **multiple** wishes shows condensed cards — a large cover photo fills the left, with name/location and edit/delete on the right — and you can **drag the grip handle to reorder** them (saved per country). A country with a **single** wish shows the full large card.
- **World view**: bottom-center button when zoomed in; zooming out or clicking it closes the right detail panel.
- **Flight deals**: set a price threshold per place; ingest prices via API; pins pulse red when below threshold.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3000 (frees port first) |
| `npm run start:all` | Open two windows: dev server + WhatsApp bot |
| `npm run whatsapp-bot` | WhatsApp → Claude Code remote-control bot |
| `npm run whatsapp-bot:stop` | Kill stale bot / Chrome processes |
| `npm run whatsapp-bot:setup` | Install Puppeteer Chrome for the bot |
| `npm run db:seed` | Demo data only (skipped if you already have places) |

## API (summary)

| Route | Auth | Purpose |
| --- | --- | --- |
| `/api/auth/login`, `/register`, `/logout`, `/me` | — | Username/password sessions |
| `/api/locations` | session for writes | CRUD wishlist entries |
| `/api/locations/:id/star` | session | Star / unstar a wish |
| `/api/locations/reorder` | session | Save manual wish order within a country (`sortOrder`) |
| `/api/settings` | session | Map theme + home airports |
| `/api/drafts`, `/drafts/ingest`, `/drafts/enrich` | session / ingest key | Draft inbox + link enrichment |
| `/api/cover-image` | public | Wikimedia cover search (multi-candidate) |
| `/api/fetch-previews` | public | Google Images (Serper.dev), Postgres-cached with fuzzy/cross-language reuse; `refresh=1` forces a fresh pull |
| `/api/cover-proxy` | public | Re-serve any public https image (browser UA, content-type checked, SSRF-guarded) so covers load reliably |
| `/api/image-proxy` | public | Strip play button from social thumbnails |
| `/api/geocode` | public | Nominatim search / reverse |
| `/api/upload` | session | Image upload to `public/uploads/` |
| `/api/flight-prices` | `X-API-Key` on POST | Flight price ingest |
| `/api/hardware-sync` | public | Flat JSON for ESP32 LED map |

See `PROJECT_CONTEXT.md` for architecture, data safety, and handoff notes.

## Data safety

Your places live in **PostgreSQL**, not in the repo. Restarting the dev server or editing code does not delete them.

**Avoid** unless you intend to wipe data:

- `npx prisma migrate reset`
- `TRAVELBOARD_SEED_RESET=1 npx prisma db seed`

**Backup** (local Postgres):

```powershell
pg_dump -U postgres -d travelboard -F c -f travelboard-backup.dump
```

## WhatsApp bot (Claude Code remote control)

Drive this Claude Code session from your phone — the bot relays `Claude <instruction>`
messages to the live session and sends replies/permission prompts back. It no longer
ingests links to the inbox (share links straight to the app instead).

1. Set `CLAUDE_CHANNEL_SECRET` in `.env` (the same value is used by `scripts/claude-channel.mjs`).
2. `npm run whatsapp-bot:setup` once.
3. Launch Claude Code with the channel: `claude --dangerously-load-development-channels server:claude-whatsapp`.
4. Run `npm run whatsapp-bot` in a separate terminal and scan the QR code.
5. Message yourself `Claude <instruction>` (e.g. `Claude list the open TODOs`).

## Android app

A thin Kotlin WebView wrapper plus a native share target lets you share Instagram reels / TikToks / journal links straight to TravelBoard — no WhatsApp. **Sharing a link always opens the prefilled "Add a place" form** to finish the details. Reach the server from anywhere via **Tailscale** (point the app at the PC's tailnet address, e.g. `http://100.x.x.x:3000`); the Settings screen stores **multiple servers** (e.g. Home Wi-Fi and Tailscale) and switches between them. Open `android/` in Android Studio and follow [`android/README.md`](android/README.md) (set a server URL, your username, and `WHATSAPP_INGEST_KEY`).
