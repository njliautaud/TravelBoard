#pragma once

/**
 * TravelBoard ESP32 config — edit include/secrets.h (copy from secrets.h.example).
 */
#include "secrets.h"

#ifndef TB_WIFI_SSID
#define TB_WIFI_SSID ""
#endif

#ifndef TB_WIFI_PASS
#define TB_WIFI_PASS ""
#endif

#ifndef TB_API_BASE
#define TB_API_BASE "http://192.168.1.42:3000"
#endif

#ifndef TB_SYNC_INTERVAL_MS
#define TB_SYNC_INTERVAL_MS 60000UL
#endif

#ifndef TB_WIFI_CONNECT_TIMEOUT_MS
#define TB_WIFI_CONNECT_TIMEOUT_MS 20000UL
#endif

/** Data transport: 0=WiFi, 1=USB serial bridge, 2=auto (USB if bridge responds). */
#ifndef TB_DATA_TRANSPORT
#define TB_DATA_TRANSPORT 0
#endif

/** Hardware double framebuffer (IDF 5.2+ only). 0 = partial LVGL refresh. */
#ifndef TB_LCD_DOUBLE_FB
#define TB_LCD_DOUBLE_FB 0
#endif
