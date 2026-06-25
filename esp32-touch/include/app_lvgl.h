#pragma once

#include <lvgl.h>

void app_lvgl_init();
lv_indev_t *app_lvgl_touch_indev();
void app_lvgl_invalidate(lv_obj_t *obj);
void app_lvgl_refresh_now();
