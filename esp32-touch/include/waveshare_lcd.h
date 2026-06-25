#pragma once

#include <esp_lcd_panel_ops.h>
#include <esp_lcd_panel_rgb.h>
#include <lvgl.h>

#include <cstddef>

static constexpr int kLcdWidth  = 1024;
static constexpr int kLcdHeight = 600;

struct WsLcdLvglConfig {
  bool double_fb = false;
  void *buf1 = nullptr;
  void *buf2 = nullptr;
  size_t buf_pixels = 0;
};

bool waveshare_lcd_init(bool init_board_io = true);
bool waveshare_lcd_lvgl_config(WsLcdLvglConfig *cfg);
esp_lcd_panel_handle_t waveshare_lcd_handle();
void waveshare_lcd_blit(const void *pixels, int x, int y, int w, int h);
void waveshare_lcd_sync_vram(const void *ptr, size_t bytes);
void waveshare_lcd_fill_screen(uint16_t color565);
void waveshare_lcd_wait_vsync();
/** LVGL flush for double-FB mode (panel handle in drv->user_data). */
void waveshare_lcd_lvgl_flush(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p);
