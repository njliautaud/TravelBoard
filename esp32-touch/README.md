# TravelBoard ESP32 Touch UI

PlatformIO firmware for the **Waveshare ESP32-S3-Touch-LCD-7B** (1024×600, ST7262 RGB + GT911 touch).

Polls your TravelBoard server and renders a dark-themed wish list + world pin map.

## Configure

Copy `include/secrets.h.example` to `include/secrets.h`:

```cpp
#define TB_WIFI_SSID "MyNetwork"
#define TB_WIFI_PASS "secret"
#define TB_API_BASE "http://192.168.1.42:3000"
#define TB_DATA_TRANSPORT 2   // 0=WiFi, 1=USB, 2=auto
```

| `TB_DATA_TRANSPORT` | Use case |
| --- | --- |
| `0` | WiFi only (field / home) |
| `1` | USB only — PC runs `npm run esp32:usb-bridge` |
| `2` | **Auto** — USB bridge if connected, else WiFi |

## Dev / demo without WiFi (USB)

Terminal 1 — Next.js:

```powershell
npm run dev
```

Terminal 2 — USB bridge (proxies API over serial):

```powershell
npm run esp32:usb-bridge
```

Set `TB_DATA_TRANSPORT` to `1` or `2` in `secrets.h`, upload firmware, connect USB. The board pulls sync + cover images from your PC instantly.

## Upload & monitor

```powershell
npm run esp32:upload
npm run esp32:monitor
```

Close the serial monitor before upload.

## Display (anti-tear)

| PlatformIO env | Behavior |
| --- | --- |
| `esp32-s3-devkitc-1` (default) | Full-screen LVGL buffers + `full_refresh` + VSYNC before each frame blit |
| `esp32-s3-idf54` | Hardware `num_fbs=2` double framebuffer (requires Tasmota platform; see `PROGRESS.md`) |

Build hardware double-FB from repo root:

```powershell
npm run esp32:build-idf54
npm run esp32:upload-idf54
```

Or with PlatformIO directly (`pio` accepts `-e`; the `esp32-pio.ps1` wrapper does **not** — use `--environment`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\esp32-pio.ps1 run --environment esp32-s3-idf54 -t upload --upload-port COM4
```

## Cover images

Server sends **RGB888** (`/api/hardware-cover?format=rgb888`). Firmware converts with `lv_color_make()` so colors match the desktop app.

## Progress

See `PROGRESS.md` for changelog and architecture notes.
