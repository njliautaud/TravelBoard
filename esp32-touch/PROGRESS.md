# TravelBoard ESP32 — progress log

## 2026-06-19 (session 2) — tear-free display, paged list, on-device cache + background net task

Everything below is on the **`esp32-s3-idf54`** env (pioarduino, Arduino 3.3.9 / ESP-IDF 5.5.4).
Build/flash: `npm run esp32:upload-idf54` (from repo root, **native PowerShell** — see build memory).
Logs are UTF-16 (Tee-Object): decode with `iconv -f UTF-16LE -t UTF-8 <log>`.

### Display pipeline (tearing → fixed)
Waveshare 7B is an RGB parallel panel (no GRAM); the S3 streams the framebuffer continuously.
Final working config in `src/waveshare_lcd.cpp` + `src/app_lvgl.cpp`:

1. **Hardware double framebuffer** — `TB_LCD_DOUBLE_FB=1` (platformio.ini). Two 1024×600×2 ≈ 1.2 MB
   FBs in PSRAM (`num_fbs=2`, no bounce buffer). Boot log must show `[lcd] double FB + 12 MHz PCLK`
   and `[lvgl] hardware double framebuffer (direct mode)` (not the bounce/partial fallback).
2. **LVGL direct mode** (`direct_mode=1`, `full_refresh=0`). full_refresh re-blitted the *entire*
   screen (incl. the antialiased world map) every frame → **~1 fps scrolling**. Direct mode redraws
   only the invalidated region; the flush swaps the whole FB **only on `lv_disp_flush_is_last`**.
3. **VSYNC-synced swap** — `on_vsync` ISR gives `sem_vsync_end` after taking `sem_gui_ready`; flush
   does give→take→`draw_bitmap` (the Espressif anti-tear reference order). **Timeout must exceed one
   frame period**: panel is ~13 Hz (~76 ms/frame) at 12 MHz PCLK, so the take timeout is 150 ms and
   the GPIO fallback (`waveshare_lcd_wait_vsync`) is 200 ms. The old 50 ms/25 ms timeouts expired
   before each vsync → unsynced swaps → tearing.
4. **Removed redundant `esp_cache_msync`** on source buffers (was in the flush paths + cover convert).
   IDF5 requires 32-byte-aligned addr+size or it errors; LVGL/heap buffers aren't aligned, so it spammed
   `E cache: esp_cache_msync ... not aligned with cache line size (0x20)` every frame and dragged the
   loop. `esp_lcd_panel_draw_bitmap` already does the FB cache writeback. `waveshare_lcd_sync_vram`
   still exists but has no callers.

Result: tearing gone; only remaining motion limit is the ~13 Hz panel refresh. **PCLK is 12 MHz**
(`kLcdPclkHz`) for PSRAM/DMA-bandwidth safety with 2 FBs + no bounce. Raising it (→16–21 MHz) would
lift the refresh ceiling but risks PSRAM underrun tear — untested this session.

### UI: paged list (replaces scrolling)
`src/ui_travelboard.cpp`: sidebar list is **non-scrollable**; ▲/▼ buttons page through `kItemsPerPage = 6`
at a time, with a `x / y` page label that dims the arrows at the ends. Scrolling at 13 Hz was unusable;
paging = one discrete sidebar redraw per tap. Page resets to 0 on filter toggle / new data.

### On-device storage + background network task (responsiveness rework)
Goal: UI never blocks on the network; wishes/covers cached so boot + open are instant; WiFi only in
the background. New modules:

- **`wish_store` (LittleFS)** — `wishes.bin` (binary `TbSyncData` blob, magic+version header) and one
  `/cv_<fnv32hex>.565` per cover (raw RGB565; filename is a hash because LittleFS name length is short).
  All ops mutex-guarded (`FsLock`, currently 3000 ms timeout) for cross-core safety.
- **`net_task` (core 0)** — owns ALL WiFi I/O: connect (`wifi_manager`), periodic `data_transport::fetch_sync`,
  download+convert+`save_cover` for each uncached cover, persist. Never calls LVGL — flips `data_dirty()`
  and exposes `wifi_connected()/wifi_ip()`. Scratch `TbSyncData` is in PSRAM; `disableCore0WDT()` because
  it does blocking HTTP. Change detection via FNV hash (avoids a 2nd 28 KB struct).
- **`main.cpp`** — boot paints cached wishes from flash *before* any network; loop only `lv_timer_handler`,
  reload-on-dirty, wifi-label, `ui_travelboard_loop`. No synchronous sync on the UI loop anymore.
- **Cover loading** — `ui_travelboard_loop` polls `wish_store::load_cover` non-blocking (300 ms throttle,
  20 s deadline); image is hidden until it loads. `cover_image_fetch` (network) was removed; conversion
  split into `cover_image_from_rgb888`.

### Build-config gotcha (LittleFS)
LDF builds the bundled `FS` lib (it's in the dependency graph) but does **not** add FS's headers to
LittleFS's own compile → `fatal error: FS.h: No such file`. Fix in platformio.ini (idf54 env):
`lib_deps += FS, LittleFS` **and** `build_flags += -I "${platformio.packages_dir}/framework-arduinoespressif32/libraries/FS/src"`.

### Close button delay — fix applied (upload11), awaiting user confirmation
Symptom: Close very delayed when opening a wish, worst right after boot. Root cause: the UI's
`wish_store::load_cover` blocked up to the 3000 ms `FsLock` timeout while `net_task` held the mutex
writing 115 KB covers during the initial caching burst → `lv_timer_handler` (and the Close tap) starved.
**Fix (in `src/wish_store.cpp` + `src/main.cpp`):** UI-thread reads use short lock timeouts —
`load_cover`/`has_cover` = `kReadLockMs` (80 ms), `load_wishes` = 300 ms — so a contended read just
fails and retries on the next poll instead of stalling. `main.cpp` now only clears `data_dirty` after a
successful `load_wishes` so a timed-out reload isn't dropped. If Close is still slow after upload11,
next suspects: the one-time 115 KB `load_cover` read itself (~25–115 ms, acceptable), or `cache_covers`
needing a bigger inter-cover `vTaskDelay`.

### Operational notes
- A stray `pio device monitor` holding COM4 causes flash to fail mid-write (`chip stopped responding`).
  Kill monitors before flashing (`Get-CimInstance Win32_Process | ? CommandLine -match 'device monitor'`).
- **Do not leave a serial monitor running** — it froze the user's terminal. For a one-shot boot capture,
  reset via .NET SerialPort RTS pulse (DTR low, pulse RTS) and read for ~20 s.
- ESP32-S3, 8 MB OPI PSRAM, 16 MB flash, partitions `default_16MB.csv` (spiffs/LittleFS ≈ 3.5 MB).
- **`disableCore0WDT()` is poison here** (regression in upload11): floods
  `E task_wdt: esp_task_wdt_reset: task not found` every idle tick → starves core-0 WiFi → never
  connects → no sync → no wishes. Removed in upload12; the net task yields enough on its own.

## 2026-06-19 (session 1) — USB transport, cover colors, anti-tear path
(superseded by session 2 for display; see git history for the partial-refresh/bounce baseline.)
