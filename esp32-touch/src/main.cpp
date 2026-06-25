/**
 * TravelBoard — Waveshare ESP32-S3-Touch-LCD-7B
 * UI runs on core 1; all WiFi I/O runs on a background task (core 0). Wishes and
 * cover images are cached to flash (wish_store) so the UI loads instantly and
 * never blocks on the network.
 */

#include <Arduino.h>
#include <lvgl.h>
#include <string.h>

#include "app_lvgl.h"
#include "board_io.hpp"
#include "config.h"
#include "data_transport.h"
#include "gt911.h"
#include "net_task.h"
#include "travelboard_api.h"
#include "ui_travelboard.h"
#include "waveshare_lcd.h"
#include "wish_store.h"

static TbSyncData g_wishes = {};  // ~28 KB — keep off the stack

static void apply_wifi_label() {
  static bool last_conn = false;
  static char last_ip[24] = "";
  const bool conn = net_task::wifi_connected();
  char ip[24];
  net_task::wifi_ip(ip, sizeof(ip));
  if (conn == last_conn && strncmp(ip, last_ip, sizeof(ip)) == 0) {
    return;
  }
  last_conn = conn;
  strncpy(last_ip, ip, sizeof(last_ip) - 1);
  last_ip[sizeof(last_ip) - 1] = '\0';
  ui_travelboard_set_wifi(conn, conn ? ip : nullptr);
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("=== TravelBoard 7B ===");
  Serial.printf("[cfg] transport mode: %d\n", TB_DATA_TRANSPORT);

  board_io::init();

  if (!gt911::init()) {
    Serial.println("[setup] touch init failed");
  }

  if (!waveshare_lcd_init(false)) {
    Serial.println("[setup] LCD init failed");
    while (true) {
      delay(1000);
    }
  }

  app_lvgl_init();
  ui_travelboard_init();

  // Instant boot: paint cached wishes from flash before any network activity.
  if (wish_store::begin() && wish_store::load_wishes(&g_wishes)) {
    ui_travelboard_apply_data(&g_wishes);
    Serial.printf("[store] loaded %d cached wishes\n", g_wishes.count);
  } else {
    ui_travelboard_set_sync_message("Sync: first run…");
  }
  app_lvgl_refresh_now();

  // Hand all network I/O to core 0 so the UI loop never stalls.
  data_transport::probe();
  net_task::begin();
  net_task::request_sync();

  Serial.println("[setup] ready");
}

void loop() {
  lv_timer_handler();

  // The network task caches fresh wishes to flash and flags us to reload.
  // Only clear the flag once we actually loaded — a contended (timed-out) read
  // leaves it set so we retry next loop instead of dropping the update.
  if (net_task::data_dirty()) {
    if (wish_store::load_wishes(&g_wishes)) {
      ui_travelboard_apply_data(&g_wishes);
      net_task::clear_dirty();
    }
  }

  apply_wifi_label();
  ui_travelboard_loop();

  delay(1);
}
