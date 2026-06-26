#include "net_task.h"

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <string.h>

#include "config.h"
#include "cover_image.h"
#include "data_transport.h"
#include "wifi_manager.h"
#include "wish_store.h"

namespace {

static volatile bool s_dirty = false;
static volatile bool s_sync_now = false;
static volatile bool s_wifi_conn = false;
static char s_ip[24] = "-";
static TaskHandle_t s_task = nullptr;

// Big scratch buffer in PSRAM — keeps it off both the task stack and internal RAM.
static TbSyncData *s_fetch = nullptr;
static uint32_t s_last_hash = 0;
static bool s_have_hash = false;

// On-demand cover handoff: the UI requests a cover by id; this task does the flash
// read / on-demand download (off the UI thread) and parks a ready PSRAM buffer.
static SemaphoreHandle_t s_cover_mtx = nullptr;
static char s_req_id[28] = "";      // id the UI wants ("" = none)
static char s_ready_id[28] = "";    // id that s_ready_buf holds
static uint16_t *s_ready_buf = nullptr;  // owned here until take_cover() claims it

void service_cover() {
  if (s_cover_mtx == nullptr) {
    return;
  }
  char id[28];
  bool already = false;
  xSemaphoreTake(s_cover_mtx, portMAX_DELAY);
  strncpy(id, s_req_id, sizeof(id));
  if (id[0] != '\0' && s_ready_buf != nullptr && strncmp(s_ready_id, id, sizeof(id)) == 0) {
    already = true;  // current request is already satisfied
  }
  xSemaphoreGive(s_cover_mtx);
  if (id[0] == '\0' || already) {
    return;
  }

  const size_t pixels = static_cast<size_t>(kCoverImgW) * kCoverImgH;
  const size_t bytes = pixels * sizeof(uint16_t);
  uint16_t *buf = nullptr;
  if (!wish_store::load_cover(id, &buf)) {
    // Not cached yet — fetch it now (on this core) so it loads the first time.
    uint8_t *rgb = nullptr;
    size_t rgb_len = 0;
    if (data_transport::fetch_cover_rgb888(id, &rgb, &rgb_len, nullptr) && rgb_len == pixels * 3U) {
      buf = cover_image_from_rgb888(rgb, pixels);
      if (buf != nullptr) {
        wish_store::save_cover(id, buf, bytes);  // persist for next time
      }
    }
    if (rgb != nullptr) {
      data_transport::release_buffer(rgb);
    }
  }
  if (buf == nullptr) {
    return;  // failed; UI times out and shows the card without an image
  }

  // Park the buffer only if the UI still wants this id (it may have moved on).
  xSemaphoreTake(s_cover_mtx, portMAX_DELAY);
  if (strncmp(s_req_id, id, sizeof(id)) == 0) {
    if (s_ready_buf != nullptr) {
      cover_image_release(s_ready_buf);  // free a previously unclaimed buffer
    }
    s_ready_buf = buf;
    strncpy(s_ready_id, id, sizeof(s_ready_id));
    buf = nullptr;
  }
  xSemaphoreGive(s_cover_mtx);
  if (buf != nullptr) {
    cover_image_release(buf);  // request changed mid-load; discard
  }
}

uint32_t hashData(const TbSyncData *d) {
  uint32_t h = 2166136261u;
  auto mix = [&](const uint8_t *p, size_t n) {
    while (n--) {
      h ^= *p++;
      h *= 16777619u;
    }
  };
  mix(reinterpret_cast<const uint8_t *>(d->generatedAt), sizeof(d->generatedAt));
  mix(reinterpret_cast<const uint8_t *>(&d->count), sizeof(d->count));
  mix(reinterpret_cast<const uint8_t *>(d->locations),
      static_cast<size_t>(d->count) * sizeof(TbLocation));
  // Include flight deals and trip in hash so UI refreshes when they change
  mix(reinterpret_cast<const uint8_t *>(&d->dealCount), sizeof(d->dealCount));
  if (d->dealCount > 0) {
    mix(reinterpret_cast<const uint8_t *>(d->deals),
        static_cast<size_t>(d->dealCount) * sizeof(TbFlightDeal));
  }
  mix(reinterpret_cast<const uint8_t *>(&d->nextTrip), sizeof(d->nextTrip));
  return h;
}

void cache_covers(const TbSyncData *d) {
  const size_t pixels = static_cast<size_t>(kCoverImgW) * kCoverImgH;
  const size_t bytes = pixels * sizeof(uint16_t);
  for (int i = 0; i < d->count; ++i) {
    service_cover();  // a wish the user just opened jumps ahead of the bulk cache
    const TbLocation &loc = d->locations[i];
    if (!loc.hasCover || wish_store::has_cover(loc.id)) {
      continue;
    }
    uint8_t *rgb = nullptr;
    size_t rgb_len = 0;
    if (!data_transport::fetch_cover_rgb888(loc.id, &rgb, &rgb_len, nullptr)) {
      continue;
    }
    if (rgb_len != pixels * 3U) {
      data_transport::release_buffer(rgb);
      continue;
    }
    uint16_t *conv = cover_image_from_rgb888(rgb, pixels);
    data_transport::release_buffer(rgb);
    if (conv == nullptr) {
      continue;
    }
    if (wish_store::save_cover(loc.id, conv, bytes)) {
      Serial.printf("[store] cached cover %s\n", loc.id);
    }
    cover_image_release(conv);
    vTaskDelay(pdMS_TO_TICKS(1));
  }
}

void do_sync() {
  if (s_fetch == nullptr) {
    return;
  }
  if (!data_transport::fetch_sync(s_fetch)) {
    Serial.println("[net] sync fetch failed");
    return;
  }
  const uint32_t h = hashData(s_fetch);
  if (!s_have_hash || h != s_last_hash) {
    if (wish_store::save_wishes(s_fetch)) {
      s_last_hash = h;
      s_have_hash = true;
      s_dirty = true;  // tell the UI core to reload from flash
      Serial.printf("[net] wishes updated: %d\n", s_fetch->count);
    }
  }
  cache_covers(s_fetch);
}

void task_fn(void *arg) {
  (void)arg;
  // NOTE: do NOT call disableCore0WDT() here — in this Arduino-ESP32 version the
  // idle-0 WDT hook keeps firing after unsubscribe and floods
  // "task_wdt: esp_task_wdt_reset: task not found", starving WiFi. This task
  // yields (vTaskDelay / delay in the download loops), so idle-0 feeds the WDT.
  const bool usb = data_transport::using_usb();
  if (!usb) {
    wifi_manager::begin(TB_WIFI_CONNECT_TIMEOUT_MS);
  }

  uint32_t last_sync = 0;
  for (;;) {
    if (usb) {
      s_wifi_conn = true;
      strncpy(s_ip, "USB", sizeof(s_ip) - 1);
      s_ip[sizeof(s_ip) - 1] = '\0';
    } else {
      wifi_manager::loop();
      const bool c = wifi_manager::connected();
      if (c) {
        strncpy(s_ip, wifi_manager::ip(), sizeof(s_ip) - 1);
        s_ip[sizeof(s_ip) - 1] = '\0';
      }
      s_wifi_conn = c;
    }

    service_cover();  // serve any pending on-demand cover request promptly

    const uint32_t now = millis();
    const bool due = (last_sync == 0) || (now - last_sync >= TB_SYNC_INTERVAL_MS);
    if ((s_sync_now || due) && (usb || s_wifi_conn)) {
      s_sync_now = false;
      do_sync();
      last_sync = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

}  // namespace

namespace net_task {

void begin() {
  if (s_task != nullptr) {
    return;
  }
  if (s_fetch == nullptr) {
    s_fetch = static_cast<TbSyncData *>(
        heap_caps_malloc(sizeof(TbSyncData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  }
  if (s_cover_mtx == nullptr) {
    s_cover_mtx = xSemaphoreCreateMutex();
  }
  xTaskCreatePinnedToCore(task_fn, "tb_net", 12288, nullptr, 3, &s_task, 0);
}

bool data_dirty() { return s_dirty; }
void clear_dirty() { s_dirty = false; }
bool wifi_connected() { return s_wifi_conn; }

void wifi_ip(char *out, size_t cap) {
  if (out == nullptr || cap == 0) {
    return;
  }
  strncpy(out, s_ip, cap - 1);
  out[cap - 1] = '\0';
}

void request_sync() { s_sync_now = true; }

void request_cover(const char *id) {
  if (id == nullptr || s_cover_mtx == nullptr) {
    return;
  }
  xSemaphoreTake(s_cover_mtx, portMAX_DELAY);
  strncpy(s_req_id, id, sizeof(s_req_id) - 1);
  s_req_id[sizeof(s_req_id) - 1] = '\0';
  // Drop a stale ready buffer for a different id.
  if (s_ready_buf != nullptr && strncmp(s_ready_id, s_req_id, sizeof(s_ready_id)) != 0) {
    cover_image_release(s_ready_buf);
    s_ready_buf = nullptr;
    s_ready_id[0] = '\0';
  }
  xSemaphoreGive(s_cover_mtx);
}

bool take_cover(const char *id, uint16_t **out_pixels) {
  if (id == nullptr || out_pixels == nullptr || s_cover_mtx == nullptr) {
    return false;
  }
  bool got = false;
  xSemaphoreTake(s_cover_mtx, portMAX_DELAY);
  if (s_ready_buf != nullptr && strncmp(s_ready_id, id, sizeof(s_ready_id)) == 0) {
    *out_pixels = s_ready_buf;  // ownership transfers to the caller
    s_ready_buf = nullptr;
    s_ready_id[0] = '\0';
    got = true;
  }
  xSemaphoreGive(s_cover_mtx);
  return got;
}

void cancel_cover() {
  if (s_cover_mtx == nullptr) {
    return;
  }
  xSemaphoreTake(s_cover_mtx, portMAX_DELAY);
  s_req_id[0] = '\0';
  if (s_ready_buf != nullptr) {
    cover_image_release(s_ready_buf);
    s_ready_buf = nullptr;
    s_ready_id[0] = '\0';
  }
  xSemaphoreGive(s_cover_mtx);
}

}  // namespace net_task
