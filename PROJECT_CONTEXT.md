# TravelBoard — AI Context & Handoff Document

> Purpose: lets a fresh AI session pick up where the last one left off. Read fully before editing.
> Last updated: 2026-06-22.

---

## 1. Project Overview

TravelBoard is a **personal travel bucket list & journal** for William and his partner:

- **Visual wishlist**: countries glow by wish density (choropleth heatmap).
- **Journal**: pins hold notes, photos, links, seasons, reminders, flight-deal thresholds.
- **Draft inbox**: `POST /api/drafts/ingest` → drafts inbox → smart-fill from caption/location/Wikimedia cover. Reserved for future producers (notifications, flight deals); links are now added via the Android share form.
- **Android app**: native share target → always opens the prefilled form; reaches the server from anywhere via **Tailscale** with a saved-servers switcher. See `android/`.
- **Profiles**: a logged-in user can switch the sidebar dropdown to view any other account's board **read-only** (`/api/users`, `/api/locations?userId=`); edits stay owner-only (small private instance — everyone logged in may view everyone).
- **Cover photos**: Google Images via Serper.dev, Postgres-cached with fuzzy/cross-language reuse and a duplicate-wish guard.
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
| Auth | Username/password (bcrypt), HMAC httpOnly cookie `tb_session` |
| Images | `sharp` declutter/resize; Wikimedia/Wikipedia in `coverImage.ts`; Google Images via `serperImages.ts`; reliability proxy `coverProxy.ts` + `/api/cover-proxy` |
| Android | Kotlin WebView wrapper + share target in `android/` (Gradle, minSdk 26, targetSdk 34 — temporary, see §10) |

---

## 3. Component Architecture

```
src/app/page.tsx
  └─ MapApp.tsx              — also owns the bottom-center All/Wished/Visited map filter
       │                       (`statusFilter`) and lazy-loads US-state polygons for states mode
       ├─ Sidebar.tsx        — dropdown View group: World | Wishes (default) | Visited | Settings
       │                       (World resets the map; Wishes/Visited filter the list) + a
       │                       Profiles group to switch to another user's board (read-only)
       ├─ SettingsPanel.tsx  — map theme, USA one-country-vs-by-state, home airports
       ├─ TravelMap.tsx      — heatmap, flag borders, Alaska/Hawaii zoom, world-view zoom threshold.
       │                       `rebuildGeo()` is the single source of truth for glow + dots:
       │                       applies statusFilter and swaps USA→state features in states mode
       ├─ SidePanel.tsx      — right panel / mobile bottom sheet (auto-closes on world view).
       │                       Country with >1 wish = condensed cards (big left photo) with
       │                       pointer-based drag-to-reorder (→ /api/locations/reorder); 1 wish = full card
       ├─ GeoBanner.tsx
       ├─ EntryForm.tsx      — Serper cover picker (generate/regenerate), enrichment prefill,
       │                       duplicate-wish guard, lat/lng at bottom
       ├─ LocationDetailsModal.tsx — full read-only wish view (opened from SidePanel "Details")
       ├─ DraftInbox.tsx
       └─ AuthModal.tsx
```

`MapApp` also reads a `?share=<url>&text=` query param (Android share target) and opens
the prefilled `EntryForm` once logged in.

### Map behavior

- **Classic theme**: amber/orange heatmap fill + glow.
- **Flag theme**: fill + glow use per-country `accent` from `src/lib/countryFlagColors.ts`.
- **Hover/select**: flag-colored border glow (`country-accent-glow` layer), zoom-scaled width/blur.
- **USA click**: sub-region bounds for Alaska/Hawaii vs lower 48 (`USA_SUBREGIONS` in `TravelMap.tsx`).
- **World view**: zoom &lt; 2.5 or World view button → `onZoomStateChange(false)` → closes SidePanel. A
  deliberate country/wish focus is guarded for ~1.6s (`lastFocusAtRef`) so a low fit-zoom on small/portrait
  screens isn't misread as a return to world view (was closing the panel on phones right after a country click).
- World view button centered in **visible map** (inset for open right panel 400px, mobile left sidebar 288px).

### Link enrichment (`src/lib/linkEnrichment.ts`)

- Instagram uses crawler User-Agent for OG tags.
- `thumbnailUrl` = reel frame; `coverImageUrl` = Wikimedia location photo.
- `/api/image-proxy` strips baked-in play button via `declutterImage.ts` (sharp inpaint).

### Cover image search (`src/lib/serperImages.ts`, `/api/fetch-previews`)

- Google Images via **Serper.dev** (`SERPER_API_KEY`); junk hosts (`lookaside.*` — they
  serve HTML) filtered out; over-fetch then slice to keep N good results.
- **SafeSearch**: every Serper request sends `safe:"active"` so explicit imagery never
  appears as a preview option or the selected cover. Defense-in-depth: `looksExplicit()`
  (denylist in `serperImages.ts`) makes obviously-explicit queries bypass the cache and the
  "similar" reuse, and purges any stale poisoned cache row when SafeSearch returns nothing.
- **Cache-first** (`ImageCache` table): exact hit → fuzzy "same wish" hit (`overlapScore`
  in `similarity.ts`, ≥0.6) → Serper pull (cached). `refresh=1` forces a fresh pull
  (the EntryForm "Regenerate" button). No key / error ⇒ deterministic placeholders, not cached.

### Reliable display (`src/lib/coverProxy.ts`, `src/lib/thumb.ts`, `/api/cover-proxy`)

- `coverImageSrc()` routes **all** remote covers through `/api/cover-proxy` (social CDNs still
  go through `image-proxy`). The proxy fetches any public https host with a browser UA, verifies
  the response is really an image, resizes with sharp, and blocks private/LAN hosts (SSRF guard).

### Similarity / duplicate detection (`src/lib/similarity.ts`)

- `tokenize()` folds accents, drops stopwords + foreign articles, singularizes, and maps a
  **multilingual travel-term synonym table** to canonical tokens (`salar`/`salt flat` → `saltflat`,
  `cascada`/`waterfall`, …). Shared by the cache match **and** the duplicate-wish guard.
- `isDuplicateWish()` gates on matching country, then activity-token overlap (location words
  removed so Eiffel ≠ Louvre). EntryForm warns via `window.confirm` before saving a likely dup.

---

## 4. Database Schema (Prisma)

Key models:

- **User**: `username`, `passwordHash`, `mapTheme` (`CLASSIC` | `FLAG`), `homeAirports` (string[] IATA codes), `usaAsStates` (Boolean — render US states as independent map units).
- **Location**: per-user wishes; `starred`, `sortOrder` (manual order within a country list), seasons, `coverImageUrl`, `priceThreshold`, media, flight prices.
- **Draft**: inbox items (`rawText`, `extractedUrl`, `source`); fed by `POST /api/drafts/ingest`, reserved for future producers (notifications, flight deals).
- **FlightPrice**: ingested via API key; latest price drives `isDeal` in serialize.
- **ImageCache**: `searchQuery` (unique, normalized), `images` (Json: `PreviewImage[]`), `source`, timestamps. Permanent Serper image cache.

Migrations: `20260612124434_init`, `20260612140349_add_starred`, `20260612150000_multi_user_drafts_seasons`, `20260613120000_user_settings`, `20260621120000_image_cache`, `20260622093000_add_location_sortorder`, `20260622210000_user_usa_as_states`.

> **Migration drift:** `User.mapTheme` was historically plain `text` in the DB (not the
> `MapTheme` enum), which broke every new-user insert with `type "public.MapTheme" does not
> exist` (reads never cast, so it went unnoticed). **Repaired 2026-06-23** with hand-written
> SQL — created the enum and converted the column (lossless; only `CLASSIC` existed). General
> rule still stands: never `prisma migrate dev` here (it wants to drop/recreate columns =
> **data loss**); add schema with hand-written SQL + `prisma migrate deploy` (how `image_cache`
> was applied).

### Seed safety (`prisma/seed.ts`)

- **Idempotent**: if user `swann` already has locations, seed **exits without deleting**.
- Wipe + demo data only with `TRAVELBOARD_SEED_RESET=1`.

---

## 5. API Routes

| Route | Auth | Notes |
| --- | --- | --- |
| `/api/auth/login`, `/register`, `/logout`, `/me` | — | Session auth |
| `/api/users` | session | Lists accounts for the sidebar profile switcher |
| `/api/locations`, `/api/locations/[id]`, `/api/locations/[id]/star` | session writes | User-scoped; `GET ?userId=` views another user's board read-only |
| `/api/locations/reorder` | session | Body `{ ids: string[] }` → writes `sortOrder` = index (per-country order) |
| `/api/settings` | session | `mapTheme`, `homeAirports` |
| `/api/drafts`, `/api/drafts/[id]`, `/api/drafts/ingest`, `/api/drafts/enrich` | session / ingest key | Draft inbox + enrichment |
| `/api/cover-image` | public | Multi-candidate Wikimedia search |
| `/api/fetch-previews` | public | Serper Google Images, cache-first (exact → fuzzy → pull); `refresh=1` forces pull |
| `/api/cover-proxy` | public | Re-serve any public https image (browser UA, image check, SSRF guard) |
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

## 7. WhatsApp Bot (Claude remote control)

- `scripts/whatsapp-bot.mjs` — listens `message_create` (self-messages) and relays
  `Claude <instruction>` / `yes <id>` messages to the Claude Code channel (see §12).
  It no longer ingests links to the draft inbox — links now go to the app directly
  (Android share → prefilled "Add a place" form). The draft inbox itself stays for
  future producers (notifications, flight deals) via `POST /api/drafts/ingest`.
- `npm run whatsapp-bot:stop` — kill stale node/chrome locks
- Requires Puppeteer Chrome: `npm run whatsapp-bot:setup`
- Env: `CLAUDE_CHANNEL_SECRET` (required — bot exits without it), `CLAUDE_CHANNEL_PORT`

---

## 8. Current Status (2026-06-22)

### Done

- Multi-user auth, starred wishes, seasons, cover images, draft inbox
- Link enrichment, image proxy, cover generate/cycle, settings (theme + airports)
- Flag border glow, Alaska/Hawaii zoom, world view UX, sidebar dropdown
- Idempotent seed; cover delete no longer re-fetches on PATCH
- **Serper Google-Images cover search** with Postgres cache + fuzzy/cross-language reuse
- **Duplicate-wish guard** + **Details modal**; cover previews adapt to portrait/landscape
- **`cover-proxy`** re-serves all cover hosts (fixed broken hotlinked/social images)
- **Android app** (`android/`): WebView + share target, **Tailscale remote access** + saved-servers switcher, share **always opens the prefilled form**, `targetSdk 34` to dodge edge-to-edge bars
- **Country panel reorder**: condensed cards (big left photo) for countries with >1 wish, pointer/touch **drag-to-reorder** persisted via `sortOrder` + `/api/locations/reorder`; single-wish countries keep the full card
- **Panel auto-close fix**: country/wish focus guarded for ~1.6s so low fit-zoom on phones no longer closes the SidePanel
- **Image SafeSearch**: `safe:"active"` + explicit-query denylist guard (no explicit covers/previews)
- **All/Wished/Visited map filter** (bottom-center segmented control) drives glow + dots; sidebar dropdown is now Select/World/Wishes/Visited/Settings
- **USA as states** setting: `src/lib/usStates.ts` (state polygons + point-in-polygon) and `src/lib/geoUnits.ts` (`unitForLocation`) make each US state a clickable, separately-counted map unit shared by the map and SidePanel; data in `public/data/us-states.geo.json`
- **Long wish names** in the condensed country panel now wrap to a second line (`line-clamp-2`) instead of truncating

### Open / roadmap

- Filter flight deals by user's `homeAirports`
- Reminder push notifications, price history chart, photo lightbox
- ESP32 + partner flight script (APIs exist)
- Console warning cleanup (reported ~29 issues, not triaged)
- Theme preference for logged-out users (localStorage)
- Wire Android wrapper APK build / signing; broaden synonym table as needed

---

## 9. Gotchas

- **Prisma 6 only.** `npx prisma generate` may EPERM if dev server locks DLL — restart dev first.
- **Never** `prisma migrate reset` on a DB with real user data. New tables: hand-written migration + `migrate deploy` (avoid `migrate dev` — it wants to drop `User.mapTheme`).
- **`SERPER_API_KEY` lives only in gitignored `.env`.** Blank ⇒ placeholder images (not cached). Cache is local Postgres (`ImageCache`), persistent, not Serper-side.
- `cover-proxy` now fetches arbitrary public https hosts — keep the SSRF blocklist in `coverProxy.ts` intact.
- Duplicate matching is intentionally aggressive (any two salt flats in a country match); `window.confirm` "add anyway" is the escape.
- PATCH locations replaces media wholesale; empty `coverImageUrl` is respected (no auto re-fetch).
- `SidePanel` is `fixed` — does not shrink map flex box; UI insets account for it.
- EntryForm stays mounted during pin-drop (`hidden` not unmount).
- Country codes in DB are ISO-3; Nominatim returns alpha-2 → `alpha2ToAlpha3()`.

---

## 10. Android App (`android/`)

- Kotlin WebView wrapper + `ACTION_SEND` share target; Gradle project, `minSdk 26`, **`targetSdk 34`**.
  - `targetSdk 34` is a **temporary** measure: Android 15 (`targetSdk 35`) forces edge-to-edge, which drew
    the action bar under the status bar and content under the bottom gesture bar (overflow menu untappable on
    a Nothing Phone 2). 34 restores opaque bars with the app inside them. Long-term fix = proper WindowInsets
    handling at `targetSdk 35`.
- `MainActivity` hosts the site (cookies, file upload); `ShareActivity` **always** opens the prefilled
  `/?share=<url>&text=<caption>` form (no offline outbox/SyncWorker — removed, since Tailscale makes the
  server reachable whenever you have a link).
- **Remote access via Tailscale**: PC's tailnet IP `100.127.72.12:3000` reaches the dev server from anywhere.
  `Config`/`SettingsActivity` store **multiple labelled servers** (Tailscale + Home Wi-Fi) and switch via a
  dropdown. Config also holds username + `WHATSAPP_INGEST_KEY`.
- Build via Android Studio, or headless: `JAVA_HOME` = Android Studio's `jbr`, invoke the cached Gradle
  (`~/.gradle/wrapper/dists/gradle-8.9-bin/.../bin/gradle.bat`) since `gradle-wrapper.jar` is gitignored.
  APK → `android/app/build/outputs/apk/debug/app-debug.apk`. See `android/README.md`.
- **Path B (deferred)**: deploy site to Vercel + hosted Postgres for true standalone (PC-off) operation.

## 11. Git / GitHub

- Repository: **TravelBoard** on GitHub (user: BSwann168).
- `.env`, `node_modules`, `.next`, `public/uploads/*`, `.whatsapp-auth/`, `.wwebjs_cache/` are gitignored.

---

## 12. Remote control: WhatsApp → Claude Code (Channels)

Drive a live Claude Code session from your phone. Built on Claude Code **Channels** (research
preview, needs Claude Code ≥ v2.1.80; permission relay ≥ v2.1.81). A *channel* is an MCP server
Claude Code spawns over stdio that pushes `notifications/claude/channel` events into the session.

### Flow

```
phone → WhatsApp self-chat ("Claude <instruction>")
  → scripts/whatsapp-bot.mjs (POST, X-Channel-Secret) → scripts/claude-channel.mjs (HTTP :8788)
  → notifications/claude/channel → live Claude Code session → Claude acts
Claude's reply / permission prompt → SSE /events → whatsapp-bot.mjs → WhatsApp self-chat → phone
```

### Pieces

- **`scripts/claude-channel.mjs`** — the channel MCP server (Node + `@modelcontextprotocol/sdk`).
  Two-way: declares `claude/channel` + `claude/channel/permission` + a `reply` tool. HTTP binds
  **127.0.0.1 only**; inbound POST requires `X-Channel-Secret`; `GET /events` is the SSE outbound
  stream. **Spawned by Claude Code over stdio — never writes to stdout (logs go to stderr).**
- **`scripts/whatsapp-bot.mjs`** — intercepts `Claude <instruction>` and `yes/no <id>` verdicts →
  POSTs to the channel; subscribes to `/events` and relays each message to the owner's own WhatsApp
  chat. Relayed messages are prefixed `💬`/`🔐` and skipped on the way back in (loop guard). All of
  this is gated behind `CLAUDE_CHANNEL_SECRET` — unset ⇒ feature off, draft flow unchanged.
- **`.mcp.json`** (project root, **not committed-as-secret**; create manually — see below) registers
  the server so Claude Code spawns it.
- Env (`.env`): `CLAUDE_CHANNEL_SECRET` (required to enable), `CLAUDE_CHANNEL_PORT` (default 8788).

### Activation (manual — agents are blocked from doing these by the safety classifier)

1. Create `.mcp.json` in the project root:
   ```json
   { "mcpServers": { "claude-whatsapp": { "command": "node", "args": ["--env-file=.env", "scripts/claude-channel.mjs"] } } }
   ```
2. Set `CLAUDE_CHANNEL_SECRET="<long random>"` in `.env`.
3. Launch Claude Code with the research-preview flag (it does **not** auto-activate):
   ```
   claude --dangerously-load-development-channels server:claude-whatsapp
   ```
   First run prompts "New MCP server found … claude-whatsapp" → **Use this MCP server**. A dim banner
   `Channels (experimental) messages from server:claude-whatsapp inject directly in this session` confirms it.
4. `npm run whatsapp-bot` (separate terminal). Test: message yourself `Claude: list the changed files`.

### Safety (do not violate)

- Run the channel session in the **default permission mode**. Do **not** add
  `--dangerously-skip-permissions` / blanket auto-accept — permission relay only protects you if
  Edit/Bash/Write actually prompt. With relay, those prompts appear in the terminal **and** on your
  phone (`🔐 … reply "yes <id>"`); first answer wins.
- HTTP is localhost-only + secret-gated; inbound rides your own self-chat. Residual risk = a
  compromised WhatsApp account injecting instructions — permission relay is the backstop.
- The MCP `claude/channel` notification path can only be smoke-tested once Claude Code is restarted
  with the flag; the HTTP/secret/SSE layer is plain Node and syntax-checks clean.

---

## 13. Two-server setup: dev (:3000) + frozen stable (:3001)

To let a friend use a stable build while you keep editing, two servers run in tandem against the
**same** Postgres (so their wishes save to this PC and appear in your profile switcher):

- **:3000 — development** — the main repo folder on `master`. Run `npm run dev`. This is what you
  and Claude edit; hot-reloads on every change.
- **:3001 — frozen stable** — a **git worktree** at `..\TravelBoard-stable` checked out to the
  `stable` branch (pinned to a known-good commit, currently `5820911`). Run **from that folder**:
  ```
  npx next dev --turbopack -p 3001 -H 0.0.0.0
  ```
  Call Next directly — **not** `npm run dev` — because `predev` (`free-port.mjs 3000`) would kill
  the :3000 server. Don't edit files in that folder (it's a live dev server; edits un-freeze it).

Setup notes / gotchas:
- The worktree needs its **own** `node_modules` (`npm install` there) and `.env` (copied; gitignored).
  A symlinked/junctioned `node_modules` does **not** work — Turbopack rejects it ("points out of the
  filesystem root"). After install, run `npx prisma generate` in the worktree (the `@prisma/client`
  postinstall does not always run it → `@prisma/client did not initialize`).
- A production build (`next build` + `next start`) currently fails on pre-existing type errors in
  `src/app/api/hardware-cover/route.ts`, so the stable instance runs `next dev` (frozen folder = stable).
- **Promote new code to the friend:** in the worktree, `git merge master` (or `git reset --hard
  master`) then restart :3001. Re-run `npm install` there if deps changed; schema changes hit both
  (shared DB).
- Friend reaches it at `http://100.127.72.12:3001` over Tailscale. If unreachable, allow port 3001
  through Windows Firewall (3000 already works).
