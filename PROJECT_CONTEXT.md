# TravelBoard — AI Context & Handoff Document

> Purpose: lets a fresh AI session pick up where the last one left off. Read fully before editing.
> Last updated: 2026-06-16.

---

## 1. Project Overview

TravelBoard is a **personal travel bucket list & journal** for William and his partner:

- **Visual wishlist**: countries glow by wish density (choropleth heatmap).
- **Journal**: pins hold notes, photos, links, seasons, reminders, flight-deal thresholds.
- **WhatsApp ingestion**: share reel links to yourself → drafts inbox → smart-fill from caption/location/Wikimedia cover.
- **Future**: ESP32 LED world map via `/api/hardware-sync`; partner Python script for flight prices.

### User preferences (do not violate)

- **No paid map/places APIs.** Nominatim + MapLibre/Carto + Wikimedia only.
- **Per-user data** must not be wiped by seed/migrate reset without explicit opt-in.
- Dark UI: slate-950, amber accents, emerald visited, rose deals, flag-colored country borders on hover/select.

---

## 2. Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15.5, App Router, TypeScript, Turbopack |
| Styling | Tailwind CSS v4 |
| Map | MapLibre GL JS v5, Carto `dark_all`, `public/data/countries.geo.json` (ISO alpha-3 ids) |
| DB | PostgreSQL 16 + **Prisma 6** (do not upgrade to v7) |
| Auth | **Clerk** (Google/Apple SSO) when keys configured; fallback to bcrypt/cookie `tb_session` |
| Images | `sharp` for thumbnail declutter; Wikimedia/Wikipedia in `coverImage.ts` |

---

## 3. Component Architecture

```
src/app/page.tsx
  └─ AppShell.tsx           — map-first layout: map always visible, tabs overlay as panels
       ├─ MapApp.tsx         — full-screen map + wishlist sidebar + entry forms
       │    ├─ Sidebar.tsx   — slide-over drawer: wishes list + settings
       │    ├─ TravelMap.tsx — MapLibre heatmap, flag borders, Alaska/Hawaii zoom
       │    ├─ SidePanel.tsx — right panel / mobile bottom sheet (auto-closes on world view)
       │    ├─ GeoBanner.tsx
       │    ├─ EntryForm.tsx — cover generate/remove, enrichment prefill
       │    ├─ DraftInbox.tsx
       │    └─ AuthModal.tsx — dual-mode: Clerk SSO or legacy username/password
       ├─ DealsView.tsx      — flight deals with scoring
       ├─ SearchView.tsx     — flight search + calendar heatmap
       ├─ JournalView.tsx    — travel journal
       ├─ AlertsPanel.tsx    — price alerts
       ├─ ToolsView.tsx      — points calculator, trip planner, memory map, etc.
       ├─ CommunityView.tsx  — social deal boards
       └─ SettingsView.tsx   — user preferences
```

### Map behavior

- **Classic theme**: amber/orange heatmap fill + glow.
- **Flag theme**: fill + glow use per-country `accent` from `src/lib/countryFlagColors.ts`.
- **Hover/select**: flag-colored border glow (`country-accent-glow` layer), zoom-scaled width/blur.
- **USA click**: sub-region bounds for Alaska/Hawaii vs lower 48 (`USA_SUBREGIONS` in `TravelMap.tsx`).
- **World view**: zoom &lt; 2.5 or World view button → `onZoomStateChange(false)` → closes SidePanel.
- World view button centered in **visible map** (inset for open right panel 400px, mobile left sidebar 288px).

### Link enrichment (`src/lib/linkEnrichment.ts`)

- Instagram uses crawler User-Agent for OG tags.
- `thumbnailUrl` = reel frame; `coverImageUrl` = Wikimedia location photo.
- `/api/image-proxy` strips baked-in play button via `declutterImage.ts` (sharp inpaint).

---

## 4. Database Schema (Prisma)

Key models:

- **User**: `username`, `passwordHash`, `mapTheme` (`CLASSIC` | `FLAG`), `homeAirports` (string[] IATA codes).
- **Location**: per-user wishes; `starred`, seasons, `coverImageUrl`, `priceThreshold`, media, flight prices.
- **Draft**: WhatsApp inbox items (`rawText`, `extractedUrl`).
- **FlightPrice**: ingested via API key; latest price drives `isDeal` in serialize.

Migrations: `20260612124434_init`, `20260612140349_add_starred`, `20260612150000_multi_user_drafts_seasons`, `20260613120000_user_settings`, `20260616040831_add_clerk_fields`.

### Seed safety (`prisma/seed.ts`)

- **Idempotent**: if user `swann` already has locations, seed **exits without deleting**.
- Wipe + demo data only with `TRAVELBOARD_SEED_RESET=1`.

---

## 5. API Routes

| Route | Auth | Notes |
| --- | --- | --- |
| `/api/auth/login`, `/register`, `/logout`, `/me` | — | Session auth |
| `/api/locations`, `/api/locations/[id]`, `/api/locations/[id]/star` | session writes | User-scoped |
| `/api/settings` | session | `mapTheme`, `homeAirports` |
| `/api/drafts`, `/api/drafts/[id]`, `/api/drafts/ingest`, `/api/drafts/enrich` | session / ingest key | WhatsApp + enrichment |
| `/api/cover-image` | public | Multi-candidate Wikimedia search |
| `/api/image-proxy` | public | Social CDN only; declutter play button |
| `/api/geocode`, `/api/upload` | public / session | Nominatim, uploads |
| `/api/flight-prices` | X-API-Key POST | Partner script |
| `/api/hardware-sync` | public | ESP32 feed |

**Not yet wired**: `homeAirports` saved in settings but not used to filter flight deals in UI/API.

---

## 6. Environment & Tooling (Windows)

- Workspace: `C:\Users\William Swann\Projects\TravelBoard`
- Node portable: `$HOME\Tools\node` — add to PATH in shells: `$env:Path = "$HOME\Tools\node;$env:Path"`
- PostgreSQL portable: `$HOME\Tools\pgsql\bin`, data `$HOME\Tools\pgdata`
- `.vscode/settings.json` adds Node/PgSQL to integrated terminal PATH
- `npm run dev` uses `predev` → `scripts/free-port.mjs` (kills node on :3000 only)
- Sandbox shell often needs `required_permissions: ["all"]`

---

## 7. WhatsApp Bot

- `scripts/whatsapp-bot.mjs` — listens `message_create` (self-messages), posts to `/api/drafts/ingest`
- `npm run whatsapp-bot:stop` — kill stale node/chrome locks
- Requires Puppeteer Chrome: `npm run whatsapp-bot:setup`
- Env: `WHATSAPP_INGEST_KEY`, `WHATSAPP_OWNER_USERNAME`, `TRAVELBOARD_API`

---

## 8. Current Status (2026-06-13)

### Done

- Multi-user auth (bcrypt + Clerk dual-mode), starred wishes, seasons, cover images, draft inbox
- **Clerk auth integration**: `@clerk/nextjs` installed, sign-in/sign-up pages, unified auth layer (`unified-auth.ts`), `clerkId` field on User model. Activate by setting `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env`
- **Map-first AppShell redesign**: Map is ALWAYS rendered as the full-screen background. Non-map tabs (Search, Deals, Journal, Tools, Community, Settings) slide in as glass-morphism overlay panels from the right. Desktop sidebar nav with active indicator. Mobile bottom tab bar.
- Link enrichment, image proxy, cover generate/cycle, settings (theme + airports)
- Flag border glow, Alaska/Hawaii zoom, world view UX
- Idempotent seed; cover delete no longer re-fetches on PATCH
- Polished welcome screen with gradient overlay and animated sign-in card
- Slide-in/fade-up animations for all panels and modals

### Open / roadmap

- **Clerk API keys**: Need Clerk dashboard account and keys (Google + Apple SSO providers)
- **PostgreSQL migration**: docker-compose.yml ready; needs Docker installed or managed Postgres
- Filter flight deals by user's `homeAirports`
- Reminder push notifications, price history chart, photo lightbox
- ESP32 + partner flight script (APIs exist)
- Console warning cleanup
- Deploy updated build to Cloudflare Pages

---

## 9. Gotchas

- **Prisma 6 only.** `npx prisma generate` may EPERM if dev server locks DLL — restart dev first.
- **Never** `prisma migrate reset` on a DB with real user data.
- PATCH locations replaces media wholesale; empty `coverImageUrl` is respected (no auto re-fetch).
- `SidePanel` is `fixed` — does not shrink map flex box; UI insets account for it.
- EntryForm stays mounted during pin-drop (`hidden` not unmount).
- Country codes in DB are ISO-3; Nominatim returns alpha-2 → `alpha2ToAlpha3()`.

---

## 10. Git / GitHub

- Repository: **TravelBoard** on GitHub (user: BSwann168).
- `.env`, `node_modules`, `.next`, `public/uploads/*`, `.whatsapp-auth/`, `.wwebjs_cache/` are gitignored.
