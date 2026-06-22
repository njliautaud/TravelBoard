#include "app_lvgl.h"

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <lvgl.h>

#include "gt911.h"
#include "waveshare_lcd.h"

static lv_indev_t *g_touch_indev = nullptr;
static bool g_frame_vsync_done = false;

static void disp_rounder(lv_disp_drv_t *drv, lv_area_t *area) {
  (void)drv;
  area->y1 = static_cast<lv_coord_t>(area->y1 & ~1);
  if (area->y2 < static_cast<lv_coord_t>(kLcdHeight - 1)) {
    area->y2 = static_cast<lv_coord_t>((area->y2 + 1) | 1);
  }
}

static void disp_flush_partial(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
  const int32_t w = area->x2 - area->x1 + 1;
  const int32_t h = area->y2 - area->y1 + 1;
  if (!g_frame_vsync_done) {
    waveshare_lcd_wait_vsync();
    g_frame_vsync_done = true;
  }
  waveshare_lcd_blit(color_p, area->x1, area->y1, w, h);
  if (lv_disp_flush_is_last(drv)) {
    g_frame_vsync_done = false;
  }
  lv_disp_flush_ready(drv);
}

static void touch_read(lv_indev_drv_t *drv, lv_indev_data_t *data) {
  (void)drv;
  static int16_t last_x = 0;
  static int16_t last_y = 0;

  gt911::poll();

  int16_t x = 0;
  int16_t y = 0;
  bool pressed = false;
  gt911::getState(&x, &y, &pressed);

  if (pressed) {
    last_x = x;
    last_y = y;
    data->point.x = last_x;
    data->point.y = last_y;
    data->state = LV_INDEV_STATE_PRESSED;
    return;
  }

  data->point.x = last_x;
  data->point.y = last_y;
  data->state = LV_INDEV_STATE_RELEASED;
}

void app_lvgl_init() {
  lv_init();

  WsLcdLvglConfig lcd_cfg = {};
  const bool have_double = waveshare_lcd_lvgl_config(&lcd_cfg);

  static lv_disp_draw_buf_t draw_buf;
  static lv_disp_drv_t disp_drv;

  if (have_double && lcd_cfg.buf1 != nullptr && lcd_cfg.buf2 != nullptr) {
    lv_disp_draw_buf_init(&draw_buf, lcd_cfg.buf1, lcd_cfg.buf2, lcd_cfg.buf_pixels);
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = kLcdWidth;
    disp_drv.ver_res = kLcdHeight;
    disp_drv.flush_cb = waveshare_lcd_lvgl_flush;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.user_data = waveshare_lcd_handle();
    // Direct mode (not full_refresh): LVGL renders only the invalidated region
    // into the back framebuffer and we swap whole FBs at vsync. Tear-free like
    // full_refresh, but scrolling no longer re-blits the entire screen (incl. the
    // antialiased world map) every frame — the ~1 fps full-refresh bottleneck.
    disp_drv.full_refresh = 0;
    disp_drv.direct_mode = 1;
    lv_disp_drv_register(&disp_drv);
    Serial.println("[lvgl] hardware double framebuffer (direct mode)");
  } else {
    static constexpr size_t kBufLines = 200;
    const size_t buf_pixels = static_cast<size_t>(kLcdWidth) * kBufLines;
    const size_t buf_bytes = buf_pixels * sizeof(lv_color_t);

    static lv_color_t *buf1 = static_cast<lv_color_t *>(
        heap_caps_malloc(buf_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    static lv_color_t *buf2 = static_cast<lv_color_t *>(
        heap_caps_malloc(buf_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));

    if (buf1 == nullptr || buf2 == nullptr) {
      Serial.println("[lvgl] ERROR: draw buffer alloc failed");
      while (true) {
        delay(1000);
      }
    }

    lv_disp_draw_buf_init(&draw_buf, buf1, buf2, buf_pixels);
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = kLcdWidth;
    disp_drv.ver_res = kLcdHeight;
    disp_drv.flush_cb = disp_flush_partial;
    disp_drv.rounder_cb = disp_rounder;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.full_refresh = 0;
    lv_disp_drv_register(&disp_drv);
    Serial.println("[lvgl] partial refresh (200-line buffer)");
  }

  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = touch_read;
  g_touch_indev = lv_indev_drv_register(&indev_drv);
}

void app_lvgl_invalidate(lv_obj_t *obj) {
  if (obj != nullptr) {
    lv_obj_invalidate(obj);
  }
}

void app_lvgl_refresh_now() { lv_refr_now(nullptr); }

lv_indev_t *app_lvgl_touch_indev() { return g_touch_indev; }
