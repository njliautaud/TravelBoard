#include "waveshare_lcd.h"

#include <Arduino.h>
#include <esp_err.h>
#include <esp_heap_caps.h>
#include <esp_idf_version.h>
#include <esp_lcd_panel_rgb.h>
#include <esp32s3/rom/cache.h>
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
#include <esp_cache.h>
#endif
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <lvgl.h>

#include "board_io.hpp"

static esp_lcd_panel_handle_t s_panel = nullptr;
static constexpr int kVsyncGpio = 3;
static bool s_double_fb = false;
static constexpr int kLcdPclkHz = 12000000;  // 12 MHz — eases PSRAM/DMA bandwidth vs 16 MHz

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
static SemaphoreHandle_t s_sem_vsync_end = nullptr;
static SemaphoreHandle_t s_sem_gui_ready = nullptr;

static bool try_panel_init(esp_lcd_rgb_panel_config_t *cfg) {
  esp_lcd_panel_handle_t panel = nullptr;
  if (esp_lcd_new_rgb_panel(cfg, &panel) != ESP_OK) {
    return false;
  }
  s_panel = panel;
  return true;
}

static bool on_vsync_event(esp_lcd_panel_handle_t panel, const esp_lcd_rgb_panel_event_data_t *edata,
                           void *user_data) {
  (void)panel;
  (void)edata;
  (void)user_data;
  BaseType_t awoken = pdFALSE;
  if (s_sem_gui_ready != nullptr && s_sem_vsync_end != nullptr) {
    if (xSemaphoreTakeFromISR(s_sem_gui_ready, &awoken) == pdTRUE) {
      xSemaphoreGiveFromISR(s_sem_vsync_end, &awoken);
    }
  }
  return awoken == pdTRUE;
}

static bool register_vsync_callbacks() {
  s_sem_vsync_end = xSemaphoreCreateBinary();
  s_sem_gui_ready = xSemaphoreCreateBinary();
  if (s_sem_vsync_end == nullptr || s_sem_gui_ready == nullptr) {
    Serial.println("[lcd] vsync semaphore alloc failed");
    return false;
  }
  esp_lcd_rgb_panel_event_callbacks_t cbs = {
      .on_vsync = on_vsync_event,
  };
  if (esp_lcd_rgb_panel_register_event_callbacks(s_panel, &cbs, nullptr) != ESP_OK) {
    Serial.println("[lcd] vsync callback register failed");
    return false;
  }
  return true;
}
#endif

bool waveshare_lcd_init(bool init_board_io) {
  if (init_board_io) {
    board_io::init();
    board_io::backlightOn();
    delay(200);
  }

  esp_lcd_rgb_panel_config_t cfg = {};
  cfg.clk_src = LCD_CLK_SRC_PLL160M;
  cfg.timings.pclk_hz = kLcdPclkHz;
  cfg.timings.h_res = kLcdWidth;
  cfg.timings.v_res = kLcdHeight;
  cfg.timings.hsync_pulse_width = 162;
  cfg.timings.hsync_back_porch = 152;
  cfg.timings.hsync_front_porch = 48;
  cfg.timings.vsync_pulse_width = 45;
  cfg.timings.vsync_back_porch = 13;
  cfg.timings.vsync_front_porch = 3;
  cfg.timings.flags.pclk_active_neg = 1;

  cfg.data_width = 16;
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
  cfg.dma_burst_size = 64;
#endif
  cfg.sram_trans_align = 4;
  cfg.psram_trans_align = 64;

  cfg.hsync_gpio_num = GPIO_NUM_46;
  cfg.vsync_gpio_num = GPIO_NUM_3;
  cfg.de_gpio_num = GPIO_NUM_5;
  cfg.pclk_gpio_num = GPIO_NUM_7;
  cfg.disp_gpio_num = GPIO_NUM_NC;

  cfg.data_gpio_nums[0] = GPIO_NUM_14;
  cfg.data_gpio_nums[1] = GPIO_NUM_38;
  cfg.data_gpio_nums[2] = GPIO_NUM_18;
  cfg.data_gpio_nums[3] = GPIO_NUM_17;
  cfg.data_gpio_nums[4] = GPIO_NUM_10;
  cfg.data_gpio_nums[5] = GPIO_NUM_39;
  cfg.data_gpio_nums[6] = GPIO_NUM_0;
  cfg.data_gpio_nums[7] = GPIO_NUM_45;
  cfg.data_gpio_nums[8] = GPIO_NUM_48;
  cfg.data_gpio_nums[9] = GPIO_NUM_47;
  cfg.data_gpio_nums[10] = GPIO_NUM_21;
  cfg.data_gpio_nums[11] = GPIO_NUM_1;
  cfg.data_gpio_nums[12] = GPIO_NUM_2;
  cfg.data_gpio_nums[13] = GPIO_NUM_42;
  cfg.data_gpio_nums[14] = GPIO_NUM_41;
  cfg.data_gpio_nums[15] = GPIO_NUM_40;

  cfg.flags.fb_in_psram = 1;

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
  cfg.num_fbs = 1;
  cfg.bounce_buffer_size_px = static_cast<size_t>(kLcdWidth) * 10U;
  s_double_fb = false;
  if (!try_panel_init(&cfg)) {
    Serial.println("[lcd] bounce-buffer init failed, retrying without bounce");
    cfg.bounce_buffer_size_px = 0;
    if (!try_panel_init(&cfg)) {
      Serial.println("[lcd] esp_lcd_new_rgb_panel failed");
      return false;
    }
    Serial.println("[lcd] IDF5 single FB, no bounce (may show tear bar)");
  } else {
    Serial.println("[lcd] IDF5 single FB + bounce (partial LVGL), 12 MHz PCLK");
  }

#if TB_LCD_DOUBLE_FB
  if (!s_double_fb) {
    Serial.println("[lcd] TB_LCD_DOUBLE_FB: trying hardware double FB…");
    if (s_panel != nullptr) {
      esp_lcd_panel_del(s_panel);
      s_panel = nullptr;
    }
    cfg.num_fbs = 2;
    cfg.bounce_buffer_size_px = 0;
    if (try_panel_init(&cfg)) {
      s_double_fb = true;
      Serial.println("[lcd] double FB + 12 MHz PCLK");
    } else {
      Serial.println("[lcd] double FB unavailable, keeping bounce panel");
      cfg.num_fbs = 1;
      cfg.bounce_buffer_size_px = static_cast<size_t>(kLcdWidth) * 10U;
      try_panel_init(&cfg);
      s_double_fb = false;
    }
  }
#endif
#else
  s_double_fb = false;
  if (esp_lcd_new_rgb_panel(&cfg, &s_panel) != ESP_OK) {
    Serial.println("[lcd] esp_lcd_new_rgb_panel failed");
    return false;
  }
  Serial.printf("[lcd] legacy single FB, PCLK %d Hz\n", kLcdPclkHz);
#endif

  if (esp_lcd_panel_init(s_panel) != ESP_OK) {
    Serial.println("[lcd] esp_lcd_panel_init failed");
    return false;
  }

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
  if (s_double_fb && !register_vsync_callbacks()) {
    return false;
  }
#endif

  pinMode(kVsyncGpio, INPUT);
  Serial.println("[lcd] esp_lcd RGB panel ready");
  return true;
}

bool waveshare_lcd_lvgl_config(WsLcdLvglConfig *cfg) {
  if (cfg == nullptr || s_panel == nullptr) {
    return false;
  }
  cfg->double_fb = s_double_fb;
  cfg->buf_pixels = static_cast<size_t>(kLcdWidth) * static_cast<size_t>(kLcdHeight);

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
  if (s_double_fb) {
    void *fb1 = nullptr;
    void *fb2 = nullptr;
    if (esp_lcd_rgb_panel_get_frame_buffer(s_panel, 2, &fb1, &fb2) != ESP_OK) {
      Serial.println("[lcd] get_frame_buffer failed");
      return false;
    }
    cfg->buf1 = fb1;
    cfg->buf2 = fb2;
    return true;
  }
#endif

  cfg->buf1 = nullptr;
  cfg->buf2 = nullptr;
  return false;
}

esp_lcd_panel_handle_t waveshare_lcd_handle() { return s_panel; }

void waveshare_lcd_sync_vram(const void *ptr, size_t bytes) {
  if (ptr == nullptr || bytes == 0) {
    return;
  }
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
  esp_cache_msync(const_cast<void *>(ptr), bytes, ESP_CACHE_MSYNC_FLAG_DIR_C2M);
#else
  Cache_WriteBack_Addr(reinterpret_cast<uint32_t>(ptr), static_cast<uint32_t>(bytes));
#endif
}

void waveshare_lcd_wait_vsync() {
  const uint32_t start = micros();
  // Must exceed one full frame period. At 12 MHz PCLK with these porches the
  // panel refreshes at ~13 Hz (~76 ms/frame), so a short timeout would expire
  // before the next vsync edge ever arrives.
  constexpr uint32_t kTimeoutUs = 200000;
  while (digitalRead(kVsyncGpio) == LOW) {
    if ((micros() - start) > kTimeoutUs) {
      return;
    }
  }
  while (digitalRead(kVsyncGpio) == HIGH) {
    if ((micros() - start) > kTimeoutUs) {
      return;
    }
  }
}

void waveshare_lcd_lvgl_flush(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
  esp_lcd_panel_handle_t panel = static_cast<esp_lcd_panel_handle_t>(drv->user_data);
  if (panel == nullptr) {
    lv_disp_flush_ready(drv);
    return;
  }
  (void)area;

  // Direct mode: LVGL has already drawn the invalidated region(s) straight into
  // the back framebuffer (color_p is the FB base). Only on the last area of a
  // refresh do we sync to vsync and switch the scanned-out FB to this one — a
  // whole-FB swap with no copy. esp_lcd_panel_draw_bitmap handles the FB cache
  // writeback (no manual, unaligned esp_cache_msync needed).
  if (lv_disp_flush_is_last(drv)) {
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 2, 0)
    if (s_double_fb && s_sem_gui_ready != nullptr && s_sem_vsync_end != nullptr) {
      xSemaphoreGive(s_sem_gui_ready);
      // Wait comfortably longer than one frame period (~76 ms @ 12 MHz) so the
      // swap stays locked to vsync (tear-free) instead of firing early.
      if (xSemaphoreTake(s_sem_vsync_end, pdMS_TO_TICKS(150)) != pdTRUE) {
        waveshare_lcd_wait_vsync();
      }
    }
#endif
    esp_lcd_panel_draw_bitmap(panel, 0, 0, kLcdWidth, kLcdHeight, color_p);
  }
  lv_disp_flush_ready(drv);
}

void waveshare_lcd_blit(const void *pixels, int x, int y, int w, int h) {
  if (s_panel == nullptr || pixels == nullptr || w <= 0 || h <= 0) {
    return;
  }
  // draw_bitmap copies + flushes the framebuffer internally; no source sync needed.
  esp_lcd_panel_draw_bitmap(s_panel, x, y, x + w, y + h, pixels);
}

void waveshare_lcd_fill_screen(uint16_t color565) {
  static uint16_t *line = nullptr;
  static size_t line_pixels = 0;

  if (line == nullptr || line_pixels != static_cast<size_t>(kLcdWidth)) {
    if (line != nullptr) {
      heap_caps_free(line);
    }
    line_pixels = kLcdWidth;
    line = static_cast<uint16_t *>(heap_caps_malloc(line_pixels * sizeof(uint16_t),
                                                   MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (line == nullptr) {
      Serial.println("[lcd] ERROR: line buffer alloc failed");
      return;
    }
  }

  for (int x = 0; x < kLcdWidth; ++x) {
    line[x] = color565;
  }

  for (int y = 0; y < kLcdHeight; ++y) {
    esp_lcd_panel_draw_bitmap(s_panel, 0, y, kLcdWidth, y + 1, line);
  }
}
