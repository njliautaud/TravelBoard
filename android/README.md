# TravelBoard Android

A thin Android wrapper around the TravelBoard website plus a native **share target**, so you can share Instagram reels / TikToks / journal links straight into TravelBoard — no WhatsApp.

## What it does

- **WebView host** (`MainActivity`) — loads the existing, mobile-responsive site. Cookies persist, so you log in once. The form's "Upload image" and external links work.
- **Share target** (`ShareActivity`) — appears as "TravelBoard" in the Android share sheet for any text/link:
  - **On your home Wi-Fi (server reachable):** opens the app straight into the prefilled *Add a place* form (it loads `/?share=<url>&text=<caption>`, which the web app turns into an auto-enriched skeleton).
  - **Away from Wi-Fi (server unreachable):** the link is queued locally and toasts *"Saved — will add to your Inbox when you're home."*
- **Background sync** (`SyncWorker`) — flushes the queue to `POST /api/drafts/ingest` (same contract as the old WhatsApp bot, `source: "android-share"`) on app open and every ~15 min, once the server is reachable again. Queued links show up in the website's **Inbox**.

## Build & run (Android Studio)

1. **Open** the `android/` folder in Android Studio (File → Open). On first sync it sets up the Gradle wrapper and downloads dependencies. (`gradle-wrapper.jar` is intentionally not committed; if you build from the CLI instead, run `gradle wrapper` once to generate it.)
2. **Run** on a phone or emulator that's on the **same Wi-Fi** as the PC running `npm run dev`.
3. On first launch you'll get the **setup** screen. Enter:
   - **Server URL** — your PC's LAN address, e.g. `http://192.168.1.20:3000` (find it with `ipconfig`). Not `localhost` — that's the phone itself.
   - **Username** — your TravelBoard account (must already exist).
   - **Ingest key** — the `WHATSAPP_INGEST_KEY` value from the server's `.env`.
   - Re-open setup anytime from the overflow menu (⋮ → Settings).
4. Make sure the dev server is reachable: it already binds `0.0.0.0` (`npm run dev`), but **Windows Firewall** may need an inbound rule allowing TCP **3000**.

## Try the share flow

- **Online:** open Instagram/Chrome → Share → **TravelBoard** → the prefilled form opens; tap **Add place**.
- **Offline:** turn on airplane mode → Share a link → you'll see the "saved" toast → rejoin Wi-Fi (or reopen the app) → it lands in **Inbox** with source `android-share`.

## Notes

- LAN-only by design: away from home, shares stay queued until the phone can reach the PC again.
- Cleartext HTTP is enabled (`usesCleartextTraffic`) because the LAN dev server is plain `http`. If you later put the site behind HTTPS (tunnel/deploy), point the Server URL at the `https://` address.
- `minSdk 26`, `targetSdk 35`. Stack: Kotlin, WebView, WorkManager, `HttpURLConnection` (no third-party networking lib).
