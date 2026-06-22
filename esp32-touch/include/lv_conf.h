/**
 * LVGL 8.x configuration for the Waveshare 7" RGB565 panel.
 * Included via -DLV_CONF_INCLUDE_SIMPLE in platformio.ini.
 */
#if 1 /* set to 0 to disable LVGL content */

#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

#define LV_COLOR_DEPTH     16
#define LV_COLOR_16_SWAP   0

#define LV_MEM_CUSTOM      0
#define LV_MEM_SIZE        (96U * 1024U)

#define LV_USE_LOG           0
#define LV_USE_PERF_MONITOR  0

#define LV_USE_BTN           1
#define LV_USE_LABEL         1
#define LV_USE_FLEX          1
#define LV_USE_IMG           1
#define LV_IMG_CACHE_DEF_SIZE  1

#define LV_FONT_MONTSERRAT_14  1
#define LV_FONT_MONTSERRAT_24  1
#define LV_FONT_DEFAULT        &lv_font_montserrat_14

#define LV_USE_THEME_DEFAULT   1

#define LV_TICK_CUSTOM         1
#define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())

#define LV_DISP_DEF_REFR_PERIOD 16
#define LV_INDEV_DEF_READ_PERIOD 5

#endif /* LV_CONF_H */
#endif /* enable switch */
