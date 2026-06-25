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
- **Social / privacy model** (reworked 2026-06-24): boards are **private** — viewable only by the owner or an **accepted friend** (`canViewBoard` / `areFriends` in `src/lib/access.ts`). The old "any logged-in user can view anyone" behavior was removed. A user can instead publish an **individual spot** (`Location.isPublic`) to a **public feed** (`/feed`, `/api/public/feed`) readable by anyone incl. logged-out visitors; only safe fields are exposed (no notes/reminders/prices). Friends are managed in the "Travel Mates" sidebar section; viewing a friend's board is read-only (`/api/locations?userId=`).
- **Cover photos**: Google Images via Serper.dev, Postgres-cached with fuzzy/cross-language reuse and a duplicate-wish guard.
- **Live**: deployed on **Vercel** at https://travel-board-psi.vercel.app (auto-deploys on push to `master`); shares the same Supabase DB as local dev — so **data changes locally also appear on the live site** (one shared DB; no separate dev DB yet). See §14.
- **Future**: **Flight Tracker** (placeholder sidebar section now); ESP32 LED world map via `/api/hardware-sync`; partner Python script for flight prices.

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
| DB | **Supabase Postgres** (cloud, shared by dev + prod) + **Prisma 6** (do not upgrade to v7). Migrated from Neon 2026-06-24 — see `SUPABASE_MIGRATION.md` + [[supabase-migration]] |
| Hosting | **Vercel** (prod). Prod build is **webpack** (`next build`, not turbopack — see §9 sharp gotcha). See §14 |
| Auth | Username/password (bcrypt), HMAC httpOnly cookie `tb_session`. Access control in `src/lib/access.ts` (private boards + accepted-friend viewing + per-spot public) |
| Images | `sharp` declutter/resize; Wikimedia/Wikipedia in `coverImage.ts`; Google Images via `serperImages.ts`; reliability proxy `coverProxy.ts` + `/api/cover-proxy`. Uploads via `src/lib/storage.ts` (local fs in dev, Supabase Storage bucket `TravelBoard` in prod) |
| Android | Kotlin WebView wrapper + share target in `android/` (Gradle, minSdk 26, targetSdk 34 — temporary, see §10) |

---

## 3. Component Architecture

```
src/app/page.tsx
  └─ MapApp.tsx              — owns the shared wished/visited/all filter (`statusFilter`, the single
       │                       source of truth) reflected by BOTH the bottom-center map toggle
       │                       (World/Wished/Visited) and the sidebar; lazy-loads US-state polygons
       ├─ Sidebar.tsx        — section dropdown: Travel Journal | Travel Mates | Flight Tracker
       │                       (placeholder) | Settings. The Journal panel = Add place button + a
       │                       World/Wished/Visited toggle (synced with the map toggle) + the list
       ├─ SettingsPanel.tsx  — map theme, USA one-country-vs-by-state, home airports
       ├─ TravelMap.tsx      — heatmap, flag borders, Alaska/Hawaii zoom, world-view zoom threshold.
       │                       Right-click a country → floating "Add wish in <country>" (own board only)
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
- **Generic admin/geography words** (`state`, `county`, `united`, …) are stopwords so a shared
  **country** can't drive a false "similar" reuse — e.g. "florida … united states" no longer
  reuses a "half dome … united states" cache row (2026-06-25 fix).

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
- **Directional distinguishers** (`north`/`south`/`east`/`west`/`new`/…): if one wish has one and
  the other doesn't, they're treated as distinct — so "North Carolina" ≠ "South Carolina" (2026-06-25 fix).

---

## 4. Database Schema (Prisma)

Key models:

- **User**: `username`, `passwordHash`, `mapTheme` (`CLASSIC` | `FLAG`), `homeAirports` (string[] IATA codes), `usaAsStates` (Boolean). Plus `Friendship` (accepted/pending) + `Notification` for the social layer.
- **Location**: per-user wishes; `starred`, `sortOrder`, seasons, `coverImageUrl`, `priceThreshold`, media, flight prices, **`isPublic`** (publish a single spot to the public feed).
- **Draft**: inbox items (`rawText`, `extractedUrl`, `source`); fed by `POST /api/drafts/ingest`.
- **FlightPrice**: ingested via API key; latest price drives `isDeal` in serialize.
- **ImageCache**: `searchQuery` (unique, normalized), `images` (Json), `source`, timestamps. Permanent Serper image cache.
- **StoredImage**: image bytes captured into the DB (e.g. an Instagram reel cover), served via `/api/stored-image/[id]` so a cover stays stable across machines.

**Access control** lives in `src/lib/access.ts`: `areFriends(a,b)` (accepted friendship, true for self) and `canViewBoard(viewerId|null, targetId)` (owner or accepted friend). A full board is owner/friend-only; a single spot is public only when `isPublic` (served by `/api/public/feed`, never exposing notes/reminders/prices).

Migrations now also include: `…friends_inbox`, `…location_backup` + `…drop_location_backup`, `20260624120000_stored_image`, `20260625000000_maptheme_enum_repair`, `20260625100000_location_public`.

> **DB = Supabase** (migrated from Neon 2026-06-24). Local dev `.env` uses the **direct** host
> `db.<ref>.supabase.co:5432` (IPv6); Vercel uses the **transaction pooler :6543** (see §14).
> **Migration drift (`mapTheme`):** historically `text` not the `MapTheme` enum, so a fresh deploy
> (Supabase) broke every new-user insert with `type "public.MapTheme" does not exist`. The enum +
> in-place conversion is now captured as `20260625000000_maptheme_enum_repair` (guarded, lossless).
> **Golden rule:** never `prisma migrate dev` (it drop/recreates columns = **data loss**); add
> schema with hand-written SQL + `prisma migrate deploy`. Applying a migration hits the shared
> Supabase DB used by prod — treat as a production change.

### Seed safety (`prisma/seed.ts`)

- **Idempotent**: if user `swann` already has locations, seed **exits without deleting**.
- Wipe + demo data only with `TRAVELBOARD_SEED_RESET=1`.

---

## 5. API Routes

| Route | Auth | Notes |
| --- | --- | --- |
| `/api/auth/login`, `/register`, `/logout`, `/me` | — | Session auth |
| `/api/users`, `/api/users/[id]/stats` | session | Account list + per-profile stats (friend-gated) |
| `/api/friends`, `/api/friends/[id]`, `/api/notifications` | session | Friend requests + inbox |
| `/api/locations`, `/api/locations/[id]`, `/api/locations/[id]/star` | session writes | Owner-scoped; `GET ?userId=` views a board **only if owner or accepted friend** (else 403) — see `access.ts` |
| `/api/public/feed` | **none** | Public feed of published spots (`isPublic`), read-only, safe fields only |
| `/api/stored-image/[id]` | none | Serves bytes from `StoredImage` |
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

## 8. Current Status (2026-06-25)

### Done

**2026-06-24 → 25 — Supabase migration + public soft-launch on Vercel:**
- **DB + media storage moved Neon → Supabase** (cloud, shared by local dev AND the live site). Data migrated + verified. The long-standing `mapTheme` drift is now captured as migration `20260625000000_maptheme_enum_repair` (guarded, data-preserving). Version-independent backup/restore: `scripts/export-db-backup.mjs` + `import-db-backup.mjs` (JSON — the local pg_dump 16 can't dump the PG17 server). See `SUPABASE_MIGRATION.md`.
- **Public feed / privacy model**: per-spot `Location.isPublic` → `/api/public/feed` (no auth) + `/feed` page. Boards are now **private** (owner or accepted friend only) via `src/lib/access.ts`; fixed a leak where a logged-out user could fetch any spot. "Publish to feed" toggle in EntryForm.
- **Media uploads** route to a Supabase Storage bucket (`TravelBoard`) in prod via `src/lib/storage.ts` + `STORAGE_DRIVER`; dev still writes `public/uploads/`.
- **Deployed to Vercel** → https://travel-board-psi.vercel.app (auto-deploys on push to `master`). See §14.
- **Beta feedback**: synced the wished/visited/all filter across the sidebar + bottom map toggle + new-entry default (one `statusFilter`); restructured the sidebar into sections (Travel Journal / Travel Mates / Flight Tracker / Settings) with a World/Wished/Visited toggle under the Journal; **right-click a country → "Add wish"**; tightened cover-cache + duplicate matching (admin-word stopwords + directional distinguishers — "florida" no longer reuses an unrelated cache; "North Carolina" ≠ "South Carolina").

**Earlier (≤ 2026-06-23):**
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
- **Two separate config stores: local `.env` (gitignored) vs Vercel env vars.** Any key the LIVE site needs (e.g. `SERPER_API_KEY`) must be added in the Vercel dashboard too — `.env` is never uploaded. Blank `SERPER_API_KEY` ⇒ placeholder images (not cached).
- **`sharp` on Vercel:** routes importing `sharp` (e.g. `/api/locations` → `instagramCover.ts`) 500 in prod unless the build traces the native binary. Fixed via `next.config.ts`: webpack build (NOT `--turbopack`), `serverExternalPackages: ["sharp"]`, and `outputFileTracingIncludes` for `@img/**`. See §14 + [[vercel-deploy]].
- **Shared DB:** local dev, the `:3001` stable worktree, AND the live Vercel site all hit the **same Supabase DB**. Adding/deleting data locally changes the live site's data. No separate dev DB yet.
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
**same** shared **Supabase** Postgres (cloud) — so their wishes save to the shared DB and appear in
your profile switcher. (Migrated from Neon → Supabase on 2026-06-24; see `SUPABASE_MIGRATION.md`.)

> **⚠️ Standing rules — apply automatically whenever you change the app:**
> 1. **Added / removed / upgraded an npm dependency?** Also run `npm install` in the
>    `..\TravelBoard-stable` worktree (it has its **own** `node_modules`), then restart `:3001`.
>    Otherwise the stable server breaks on the missing/old package.
> 2. **Changed the Prisma schema or ran a migration?** It hits **both** servers — they share one
>    database. Use hand-written SQL + `prisma migrate deploy` (never `migrate dev`), and remember
>    `:3001` runs older code, so avoid schema changes that break it while the friend is connected.

- **:3000 — development** — the main repo folder on `master`. Run `npm run dev`. This is what you
  and Claude edit; hot-reloads on every change.
- **:3001 — stable** — a **git worktree** at `..\TravelBoard-stable` checked out to the
  `stable` branch (brought current with `master` on 2026-06-24; advance it deliberately, not on every
  edit). Run **from that folder**:
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
- The production build (`next build`) passes as of 2026-06-24 (fixed the `hardware-cover` type
  errors — Buffer typing + a `body` shadowing bug — for the Vercel deploy). The stable instance
  still runs `next dev` for hot-reload convenience, but `next build`/`next start` now work too.
- **Promote new code to the friend:** in the worktree, `git merge master` (or `git reset --hard
  master`) then restart :3001. Re-run `npm install` there if deps changed; schema changes hit both
  (shared DB).
- Friend reaches it at `http://100.127.72.12:3001` over Tailscale. If unreachable, allow port 3001
  through Windows Firewall (3000 already works).

---

## 14. Vercel deployment (public soft-launch)

Live at **https://travel-board-psi.vercel.app** (Vercel project `travel-board`, team
`team_UpadywpuWBXfEo1Fv870tXFq`, GitHub-connected → **push to `master` auto-deploys**). Full
runbook: `SUPABASE_MIGRATION.md`; memory: [[vercel-deploy]], [[supabase-migration]].

- **Dev vs prod**: edit on `localhost:3000` (only `git push` updates the public site). Code is
  isolated per machine, but the **DB is shared** (Supabase) — data changes locally hit the live site.
- **DB URL differs by environment**: local `.env` = direct `db.<ref>.supabase.co:5432` (IPv6, works
  from the PC). **Vercel `DATABASE_URL` = transaction pooler `aws-1-us-east-2.pooler.supabase.com:6543`
  + `?pgbouncer=true&connection_limit=1`** (serverless is IPv4; the direct host is IPv6-only). No
  Supabase IPv4 add-on needed — the pooler is IPv4.
- **Vercel env vars** (Dashboard → Settings → Env, Production): `DATABASE_URL` (6543 pooler),
  `DIRECT_URL`, `SESSION_SECRET` (fresh, not the local one), `STORAGE_DRIVER=supabase`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=TravelBoard`, `SERPER_API_KEY`. NOT the
  WhatsApp/flight/hardware keys (local tools only).
- **Build fixes that must stay** (`package.json` + `next.config.ts`): `"build": "next build"`
  (webpack, NOT turbopack), `postinstall: prisma generate`, `serverExternalPackages: ["sharp"]`,
  `outputFileTracingIncludes` for `@img/**` (else `/api/locations` 500s on a sharp `.so` load error).
- **`.vercelignore`** excludes `.whatsapp-auth`, `esp32-touch`, `backups`, etc. (the CLI doesn't read
  `.gitignore`; `.whatsapp-auth` holds OS-locked files that break `vercel deploy`).
- **CLI deploy** (needs a Vercel token): `npx vercel@latest deploy --prod --yes --token <T> --scope team_UpadywpuWBXfEo1Fv870tXFq`. Normally unnecessary — just `git push`.
- **Idea for later**: a separate Supabase project as an isolated dev DB so local testing doesn't
  touch live data.
