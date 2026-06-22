You are an expert embedded systems engineer specializing in the Espressif ESP-IDF/Arduino framework, esp_lcd drivers, and LVGL 8.3 graphics pipelines. 

I am building "TravelBoard"—an interactive, wall-mounted travel tracking map. The overall core objectives, layout blueprints, and features of this project are detailed in the root `README.md` file. Read that file first to understand the scope.

### 1. Hardware Architecture & Bottlenecks
We are developing on a Waveshare ESP32-S3-Touch-LCD-7B module. You must account for these exact hardware specs:
- MCU: ESP32-S3 (Xtensa 32-bit LX7 dual-core, 240MHz)
- Memory: 16MB Flash, 8MB Octal PSRAM
- Screen: 7-inch IPS panel over an RGB TTL interface
- Pixel Density / Resolution: 1024x600 pixels (65K colors)

CRITICAL NODE: Driving 1024x600 pixels stretches the limits of the ESP32-S3's 8MB PSRAM bus bandwidth (~73MB/s required just for a 60Hz scanline stream). The previous AI assistant struggled with severe screen tearing and display shaking during list scrolling and UI rendering, ultimately breaking the PlatformIO build toolchain trying to patch it.

### 2. Operational Rules: Interactive "Cook & Verify" Loop
Do not write code silently in a black box. You must maintain a strict interactive loop with me:
1. Explain your architectural plan before changing display or driver files.
2. Ask me clarifying questions if you run into any ambiguities regarding our setup.
3. Every time you compile and upload a build change ("cooking"), you must stop and explicitly ask me to look at the physical screen and verify what is rendering (e.g., checking for shaking, tearing, or blank frames) before moving to the next optimization phase.

### 3. Step 1: Repair the PlatformIO Environment
The current workspace has a fractured compilation path. The advanced `esp32-s3-idf54` environment failed due to a corrupted or incomplete Tasmota/toolchain framework download.
- Inspect `platformio.ini` and the current terminal setup.
- Execute terminal commands to purge the corrupted `.pio` cache directory.
- Fix the toolchain/platform target so we can successfully build a binary using modern `esp_lcd` features.

### 4. Step 2: Read Existing Code & Protect Working Features
Do not overwrite our stable application layers. Read all files in the TravelBoard workspace and ensure the following modules remain intact:
- Backups: Reference `backups/esp32-touch-stable-2026-06-19/` and its `RESTORE.md` to see what worked previously.
- GT911 Touch: Retain the stable state machine processing the `0x814E` status register (properly passing pressed/released states to prevent locked buttons).
- Async Sync Safety: Keep data parsing isolated from the core UI loop. Do not reintroduce stack overflows by trying to pass the massive ~28KB `TbSyncData` struct directly onto limited task stacks.

### 5. Step 3: Solve the 1024x600 Screen Tearing
Because we are pushing a massive amount of pixels over the PSRAM bus, you must deploy one of these hardware-aligned rendering strategies:
- Strategy A (True Double Framebuffering): Allocate two full-size 1024x600 framebuffers in PSRAM (`num_fbs = 2`), configure LVGL to use full-frame direct mode (`full_refresh = 1`, `direct_mode = 1`), and link the display flusher to the hardware VSYNC semaphore so buffer swaps only happen during vertical blanking.
- Strategy B (Internal SRAM Bounce Buffers): Implement a dual bounce-buffer scheme using the ultra-fast internal SRAM (e.g., `bounce_buffer_size_px = 1024 * 10`) to act as a DMA cache layer, insulating the display pins from PSRAM bus contention during Wi-Fi or API calls.
- Strategy C (PCLK Throttling): Dial back the pixel clock (`pclk_hz`) from 16MHz down to a stable 12MHz–14MHz to lower the overall bus pressure, paired with tight sync updates.

Let's begin. Scan the workspace files, inspect the `README.md`, and present your plan for fixing the PlatformIO build environment first.