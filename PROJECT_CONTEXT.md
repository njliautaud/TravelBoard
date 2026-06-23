# TravelBoard — AI Context & Handoff Document

> Purpose: lets a fresh AI session pick up where the last one left off. Read fully before editing.
> Last updated: 2026-06-23.

---

## 1. Project Overview

TravelBoard is a **personal travel bucket list & journal** for William and his partner:

- **Visual wishlist**: countries glow by wish density (choropleth heatmap).
- **Journal**: pins hold notes, photos, links, seasons, reminders, flight-deal thresholds.
- **WhatsApp ingestion**: share reel links to yourself → drafts inbox → smart-fill from caption/location/Wikimedia cover.
- **Flight deals**: personalized deal feed with award flight integration (seats.aero), loyalty program tracking, price watches.
- **Social boards**: community deal sharing with upvotes and comments.
- **Trip planner**: multi-leg trip planning with fare tracking.
- **Points optimizer**: credit card portfolio management with transfer partner optimization.
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
| DB | SQLite + **Prisma 6** (do not upgrade to v7) |
| Auth | **Clerk** (@clerk/nextjs v7.5.3, Google/Apple SSO) when keys configured; fallback to bcrypt/cookie `tb_session`. Unified via `lib/unified-auth.ts` |
| Images | `sharp` for thumbnail declutter; Wikimedia/Wikipedia in `coverImage.ts` |
| Core package | `@travelboard/core` — airport data, flight providers, loyalty program catalogs |

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
       │    ├─ DealsMapPanel.tsx — floating deals panel with origin-based deal feed
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

- **User**: `username`, `passwordHash`, `clerkId`, `mapTheme` (`CLASSIC` | `FLAG`), `homeAirports` (JSON string of IATA codes), `flightPref`, `distancePref`, `loyaltyPrograms` (JSON string), `onboarded`.
- **Location**: per-user wishes; `starred`, seasons, `coverImageUrl`, `priceThreshold`, media, flight prices.
- **Draft**: WhatsApp inbox items (`rawText`, `extractedUrl`).
- **FlightPrice**: ingested via API key; latest price drives `isDeal` in serialize.
- **FareCache / FareHistory**: cached flight fares with deal scoring and price history.
- **AwardCache**: award flight availability from seats.aero.
- **Watch / AlertLog**: price watch alerts for routes.
- **Trip / TripPlan / TripPlanLeg**: trip tracking and multi-leg trip planning.
- **JournalEntry**: travel journal with country/tag filtering.
- **CardProfile / LoyaltyBalance**: credit card and loyalty program portfolio.
- **SocialBoard / BoardDeal / BoardComment**: community deal boards.
- **GamificationProgress**: user engagement tracking.
- **NotificationPref / AnalyticsEvent / AppSetting**: system config.

### Seed safety (`prisma/seed.ts`)

- **Idempotent**: if user `swann` already has locations, seed **exits without deleting**.
- Wipe + demo data only with `TRAVELBOARD_SEED_RESET=1`.

---

## 5. API Routes

All routes have standardized error handling with try/catch, consistent error response format `{ error, status }`, and JSDoc documentation.

### Authentication

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/auth/login` | public | POST | Legacy username/password login |
| `/api/auth/register` | public | POST | Legacy account creation |
| `/api/auth/logout` | public | POST | Clear session cookie |
| `/api/auth/me` | session | GET | Current user info |

### Core Data (auth required)

| Route | Method | Notes |
| --- | --- | --- |
| `/api/locations` | GET, POST | User's saved locations (pins) |
| `/api/locations/[id]` | GET, PATCH, DELETE | Single location CRUD |
| `/api/locations/[id]/star` | PATCH | Toggle starred status |
| `/api/settings` | GET, PATCH | Map theme + home airports |
| `/api/prefs` | GET, PUT | User preferences |
| `/api/profile` | GET, PATCH | User profile |
| `/api/saved-deals` | GET, POST, DELETE | Saved flight deals |
| `/api/savings` | GET | Savings tracker |

### Flights & Deals

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/fares/top-deals` | optional | GET | Personalized deal feed (falls back to global deals if origin has none) |
| `/api/fares` | public | GET | Fare search |
| `/api/fares/history/[origin]/[destination]` | public | GET | Price history |
| `/api/fares/warm` | API key | POST | Warm fare cache |
| `/api/deals/countries` | public | GET | Deal countries |
| `/api/deals/routes` | public | GET | Deal routes |
| `/api/deals/compare` | public | GET | Compare deals |
| `/api/deals/score` | public | GET | Deal scoring |
| `/api/fare-prediction` | public | POST | Price prediction |
| `/api/flight-prices` | API key | POST | Partner flight price ingestion |
| `/api/search` | public | GET | Unified search (places + flights) |
| `/api/search/calendar` | public | GET | Calendar view / price history |

### Loyalty & Points

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/loyalty` | required | GET, POST | Loyalty balance CRUD |
| `/api/loyalty/[id]` | required | PUT, DELETE | Single balance |
| `/api/loyalty/programs` | public | GET | Reference data catalog |
| `/api/loyalty/transfers` | public | GET | Transfer partners by cards held |
| `/api/points/calculator` | public | POST | Points value calculator |
| `/api/points/cards` | required | GET, POST | Card profile CRUD |
| `/api/points/cards/[id]` | required | PUT, DELETE | Single card profile |
| `/api/points/optimize` | required | POST | Transfer optimization |
| `/api/points/sweet-spots` | public | GET | Points sweet spots |

### Trips & Journal

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/trips` | required | GET, POST | Trip CRUD |
| `/api/trips/[id]` | required | GET, PUT, DELETE | Single trip |
| `/api/trips/stats` | required | GET | Trip statistics |
| `/api/trips/plans` | required | GET, POST | Trip plan CRUD |
| `/api/trips/plans/[id]` | required | GET, PUT, DELETE | Single plan |
| `/api/trips/plans/[id]/legs` | required | GET, POST | Plan legs |
| `/api/trips/plans/[id]/legs/[legId]` | required | PUT, DELETE | Single leg |
| `/api/journal` | required | GET, POST | Journal entries |
| `/api/journal/[id]` | required | GET, PUT, DELETE | Single entry |
| `/api/journal/[id]/public` | public | GET | Public journal entry |
| `/api/journal/countries` | required | GET | Countries visited |
| `/api/journal/stats` | required | GET | Journal statistics |
| `/api/journal/import` | required | POST | Import from URL |

### Social & Gamification

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/boards` | optional/required | GET, POST | Social deal boards |
| `/api/boards/[id]` | optional/required | GET, PUT, DELETE | Single board |
| `/api/boards/[id]/deals` | public/required | GET, POST | Board deals |
| `/api/boards/[id]/deals/[dealId]/vote` | required | POST | Vote on deal |
| `/api/boards/[id]/deals/[dealId]/comments` | public/required | GET, POST | Deal comments |
| `/api/gamification/badges` | required | GET | User badges |
| `/api/gamification/progress` | required | GET | Progress stats |
| `/api/gamification/event` | required | POST | Record event |

### Drafts & Content

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/drafts` | required | GET, POST | Draft inbox |
| `/api/drafts/[id]` | required | GET, PUT, DELETE | Single draft |
| `/api/drafts/[id]/promote` | required | POST | Promote draft to location |
| `/api/drafts/ingest` | API key | POST | WhatsApp ingestion |
| `/api/drafts/enrich` | required | POST | Link enrichment |
| `/api/drafts/import` | required | POST | Bulk import |

### Utilities

| Route | Auth | Method | Notes |
| --- | --- | --- | --- |
| `/api/onboarding` | optional | GET, POST | Onboarding flow |
| `/api/geocode` | public | GET | Nominatim proxy (8s timeout) |
| `/api/image-proxy` | public | GET | Social CDN proxy with play button removal (10s timeout) |
| `/api/cover-image` | public | GET | Wikimedia cover image search |
| `/api/upload` | required | POST | Image upload (15 MB max) |
| `/api/hardware-sync` | public | GET | ESP32 LED map feed |
| `/api/analytics` | public | POST | Event tracking |
| `/api/admin/stats` | admin | GET | Admin statistics |
| `/api/watches` | required | GET, POST | Price watches |
| `/api/watches/[id]` | required | PUT, DELETE | Single watch |
| `/api/alerts` | required | GET | User alerts |
| `/api/alerts/[id]/ack` | required | POST | Acknowledge alert |
| `/api/awards/availability` | public | GET | Award availability |
| `/api/awards/refresh` | API key | POST | Refresh award cache |
| `/api/packing` | public | POST | Packing list with weather (5s timeout) |
| `/api/destinations/[code]` | public | GET | Destination info |
| `/api/lounges/search` | public | GET | Lounge search |
| `/api/lounges/[id]` | public | GET | Lounge details |
| `/api/export/csv` | required | GET | Export data as CSV |
| `/api/export/json` | required | GET | Export data as JSON |
| `/api/track/[flight]` | public | GET | Flight tracking |

### API Key Authentication

Three API keys are used for external integrations:
- `FLIGHT_API_KEY` — validated via `X-API-Key` header for flight price ingestion
- `WHATSAPP_INGEST_KEY` — validated via `X-API-Key` header for WhatsApp draft ingestion
- `SEATSAERO_API_KEY` — used for seats.aero award flight API calls

API key validation uses constant-time comparison (in `lib/api-utils.ts`) to prevent timing attacks.

### Middleware

Clerk middleware protects authenticated routes. Public routes are explicitly whitelisted:
- Auth endpoints, deals, search, reference data, webhooks, geocode, static assets
- All other routes require Clerk or legacy session authentication

---

## 6. Backend Architecture

### Shared Utilities (`lib/api-utils.ts`)

Centralized API route helpers:
- `apiError(message, status)` — standardized error response
- `withErrorHandler(handler)` — try/catch wrapper
- `requireAuth()` / `optionalAuth()` — auth helpers
- `validateApiKey(req, headerName, envVar)` — constant-time API key validation
- `countryNameToISO2(name)` — shared country code mapping (eliminated duplication from deals routes)

### Auth (`lib/unified-auth.ts`)

Single `getAuthUser()` function used by ALL routes:
1. Tries Clerk auth first (via `@clerk/nextjs`)
2. Falls back to legacy cookie-based session auth
3. Returns `AuthUser` with `{ id, username, clerkId?, imageUrl? }` or `null`

### Error Handling

Every route handler is wrapped in try/catch with standardized error format:
```json
{ "error": "Human-readable message", "status": 500 }
```

### External API Timeouts

All external fetch calls have `AbortSignal.timeout()`:
- Nominatim geocoding: 8s
- Wikipedia/Wikimedia APIs: 8s
- Open-Meteo weather: 5s
- Image proxy upstream: 10s
- OpenGraph fetching: 10s
- oEmbed endpoints: 8s

---

## 7. Environment & Deployment

### Development (Jupiter — Linux)
- Workspace: `/home/jupiter/TravelBoard`
- `npm run dev` — development server with Turbopack

### Cloudflare Pages Deployment
- Script: `scripts/deploy-cloudflare.sh`
- Builds static export, strips API routes/middleware
- Replaces `@clerk/nextjs` with `@clerk/react` for client-side
- Deploys to `travelboard-9q0.pages.dev`

### Environment Variables
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth
- `FLIGHT_API_KEY` — flight price ingestion
- `WHATSAPP_INGEST_KEY` — WhatsApp bot ingestion
- `SEATSAERO_API_KEY` — award flight data
- `WHATSAPP_OWNER_USERNAME` / `TRAVELBOARD_API` — WhatsApp bot config

---

## 8. WhatsApp Bot

- `scripts/whatsapp-bot.mjs` — listens `message_create` (self-messages), posts to `/api/drafts/ingest`
- `npm run whatsapp-bot:stop` — kill stale node/chrome locks
- Requires Puppeteer Chrome: `npm run whatsapp-bot:setup`
- Env: `WHATSAPP_INGEST_KEY`, `WHATSAPP_OWNER_USERNAME`, `TRAVELBOARD_API`

---

## 9. Current Status (2026-06-23)

### Done

- Multi-user auth (bcrypt + Clerk dual-mode), starred wishes, seasons, cover images, draft inbox
- **Clerk auth integration**: `@clerk/nextjs` installed, sign-in/sign-up pages, unified auth layer (`unified-auth.ts`), `clerkId` field on User model
- **Map-first AppShell redesign**: Map is ALWAYS rendered as full-screen background. Non-map tabs slide in as glass-morphism overlay panels
- Link enrichment, image proxy, cover generate/cycle, settings (theme + airports)
- Flag border glow, Alaska/Hawaii zoom, world view UX
- Onboarding wizard with airport/preference selection
- Flight deals with personalized scoring, award flight integration
- Points calculator and transfer partner optimizer
- Trip planner with multi-leg support
- Travel journal with import/export
- Social deal boards with voting and comments
- Price watches with alerting
- Gamification system (badges, progress tracking)
- **Backend robustification (2026-06-23)**:
  - All 78 API routes wrapped in try/catch with standardized `{ error, status }` format
  - All routes migrated from `getSessionUser` to unified `getAuthUser` (Clerk + legacy)
  - Centralized API key validation with constant-time comparison (`lib/api-utils.ts`)
  - Eliminated ~100 lines of duplicate country-name-to-ISO2 mapping
  - Middleware hardened: specific public route whitelist instead of blanket `/api(.*)` public
  - All external fetch calls have timeout handling (AbortSignal.timeout)
  - JSDoc added to all route handlers documenting auth requirements and request/response shapes
  - Top-deals endpoint falls back to global deals when origin-specific query returns empty
  - TypeScript clean (0 new errors; 7 pre-existing Clerk/Cloudflare type issues unchanged)

### Open / roadmap

- **Clerk API keys**: Need Clerk dashboard account and keys (Google + Apple SSO providers)
- Reminder push notifications, price history chart, photo lightbox
- ESP32 + partner flight script (APIs exist)
- Console warning cleanup
- Deploy updated build to Cloudflare Pages

---

## 10. Gotchas

- **Prisma 6 only.** `npx prisma generate` may EPERM if dev server locks DLL — restart dev first.
- **Never** `prisma migrate reset` on a DB with real user data.
- PATCH locations replaces media wholesale; empty `coverImageUrl` is respected (no auto re-fetch).
- `SidePanel` is `fixed` — does not shrink map flex box; UI insets account for it.
- EntryForm stays mounted during pin-drop (`hidden` not unmount).
- Country codes in DB are ISO-3; Nominatim returns alpha-2 → `alpha2ToAlpha3()`.
- **Pre-existing TypeScript errors** (7 total, not bugs — type definition mismatches):
  - `functions/api/[[path]].ts`: PagesFunction type not installed (Cloudflare Workers)
  - `layout.tsx`, `sign-in`, `sign-up`, `ClerkClientProvider`: `colorText` not in Clerk Variables type
  - `tracker.ts`: Window cast issue

---

## 11. Git / GitHub

- Repository: **TravelBoard** on GitHub (user: BSwann168).
- `.env`, `node_modules`, `.next`, `public/uploads/*`, `.whatsapp-auth/`, `.wwebjs_cache/` are gitignored.
