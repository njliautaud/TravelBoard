# TravelBoard Android

A thin Android wrapper around the TravelBoard website plus a native **share target**, so you can share Instagram reels / TikToks / journal links straight into TravelBoard — no WhatsApp.

## What it does

- **WebView host** (`MainActivity`) — loads the existing, mobile-responsive site. Cookies persist, so you log in once. The form's "Upload image" and external links work.
- **Share target** (`ShareActivity`) — appears as "TravelBoard" in the Android share sheet for any text/link, and **always opens the prefilled *Add a place* form** (it loads `/?share=<url>&text=<caption>`, which the web app turns into an auto-enriched skeleton) so you can finish the details and save. With Tailscale the server is reachable wherever you have the link, so there's no separate offline queue.
- **Saved servers** (`Config` / `SettingsActivity`) — store more than one server (label + URL) and switch between them from the dropdown: your PC's **Tailscale** address (`http://100.x.x.x:3000`) for anywhere, and its **LAN** address (`http://192.168.x.x:3000`) for home Wi-Fi when Tailscale is off.

## Build & run (Android Studio)

1. **Open** the `android/` folder in Android Studio (File → Open). On first sync it sets up the Gradle wrapper and downloads dependencies. (`gradle-wrapper.jar` is intentionally not committed; if you build from the CLI instead, run `gradle wrapper` once to generate it.)
2. **Run** on a phone connected to the PC's **Tailscale** tailnet (or on the same Wi-Fi). The PC must be running `npm run dev`.
3. On first launch you'll get the **setup** screen. Enter:
   - **Server URL** — the PC's address. Over Tailscale: `http://100.x.x.x:3000` (the PC's tailnet IP). On home Wi-Fi: the LAN address, e.g. `http://192.168.1.20:3000` (find it with `ipconfig`). Not `localhost` — that's the phone itself.
   - **Label** — a name for this server (e.g. `Tailscale`, `Home`). Saved entries appear in the dropdown so you can switch quickly.
   - **Username** — your TravelBoard account (must already exist).
   - **Ingest key** — the `WHATSAPP_INGEST_KEY` value from the server's `.env`.
   - Re-open setup anytime from the overflow menu (⋮ → Settings).
4. Make sure the dev server is reachable: it already binds `0.0.0.0` (`npm run dev`), but **Windows Firewall** may need an inbound rule allowing TCP **3000** (over Tailscale, on the Tailscale interface).

## Try the share flow

Open Instagram/Chrome → Share → **TravelBoard** → the prefilled *Add a place* form opens; finish the details and tap **Add place**.

## Notes

- **Remote access via Tailscale**: install Tailscale on the PC and phone (same account); the PC keeps its tailnet IP wherever you are, so the app works off home Wi-Fi as long as the PC is on and serving. A future cloud deploy (Vercel + hosted Postgres) would remove the PC-on requirement.
- Cleartext HTTP is enabled (`usesCleartextTraffic`) because the dev server is plain `http`. If you later put the site behind HTTPS (tunnel/deploy), point the Server URL at the `https://` address.
- `minSdk 26`, `targetSdk 34` (temporary: keeps the classic opaque status/nav bars so content isn't drawn under the top/bottom system regions on edge-to-edge phones; the long-term fix is Android-15 WindowInsets handling at `targetSdk 35`). Stack: Kotlin, WebView, `HttpURLConnection` (no third-party networking lib).
