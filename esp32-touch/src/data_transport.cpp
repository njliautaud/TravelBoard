#include "data_transport.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <cstring>
#include <strings.h>

#include "config.h"
#include "cover_image.h"
#include "usb_link.h"
#include "wifi_manager.h"

namespace {

static bool s_use_usb = false;
static bool s_probed = false;

int cfg_mode() { return TB_DATA_TRANSPORT; }

void copyField(char *dst, size_t dst_len, const char *src) {
  if (dst == nullptr || dst_len == 0) {
    return;
  }
  if (src == nullptr) {
    dst[0] = '\0';
    return;
  }
  strncpy(dst, src, dst_len - 1);
  dst[dst_len - 1] = '\0';
}

int compareLocations(const TbLocation *a, const TbLocation *b) {
  if (a->isDeal != b->isDeal) {
    return a->isDeal ? -1 : 1;
  }
  const bool a_visited = strncmp(a->status, "VISITED", 8) == 0;
  const bool b_visited = strncmp(b->status, "VISITED", 8) == 0;
  if (a_visited != b_visited) {
    return a_visited ? 1 : -1;
  }
  return strcasecmp(a->name, b->name);
}

void sortLocations(TbSyncData *data) {
  if (data == nullptr || data->count < 2) {
    return;
  }
  for (int i = 0; i < data->count - 1; ++i) {
    for (int j = i + 1; j < data->count; ++j) {
      if (compareLocations(&data->locations[i], &data->locations[j]) > 0) {
        TbLocation tmp = data->locations[i];
        data->locations[i] = data->locations[j];
        data->locations[j] = tmp;
      }
    }
  }
}

bool parse_sync_json(const char *body, TbSyncData *out) {
  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[sync] JSON error: %s\n", err.c_str());
    return false;
  }

  copyField(out->generatedAt, sizeof(out->generatedAt), doc["generatedAt"] | "");
  out->count = 0;

  JsonArray arr = doc["locations"].as<JsonArray>();
  for (JsonObject item : arr) {
    if (out->count >= kTbMaxLocations) {
      break;
    }
    TbLocation &loc = out->locations[out->count];
    memset(&loc, 0, sizeof(loc));
    out->count++;
    copyField(loc.id, sizeof(loc.id), item["id"] | "");
    copyField(loc.name, sizeof(loc.name), item["name"] | "");
    copyField(loc.countryCode, sizeof(loc.countryCode), item["countryCode"] | "");
    copyField(loc.countryName, sizeof(loc.countryName), item["countryName"] | "");
    copyField(loc.city, sizeof(loc.city), item["city"] | "");
    copyField(loc.region, sizeof(loc.region), item["region"] | "");
    copyField(loc.status, sizeof(loc.status), item["status"] | "TO_VISIT");
    copyField(loc.notes, sizeof(loc.notes), item["notes"] | "");
    loc.lat = item["lat"] | 0.0;
    loc.lng = item["lng"] | 0.0;
    loc.isDeal = item["isDeal"] | false;
    const char *cover = item["coverImageUrl"] | "";
    loc.hasCover = cover[0] != '\0';
    if (!item["latestPrice"].isNull()) {
      loc.hasPrice = true;
      loc.latestPrice = item["latestPrice"] | 0.0f;
      copyField(loc.priceCurrency, sizeof(loc.priceCurrency), item["priceCurrency"] | "USD");
    } else {
      loc.hasPrice = false;
      loc.latestPrice = 0.0f;
      loc.priceCurrency[0] = '\0';
    }
  }

  sortLocations(out);

  // Parse flight deals (backward-compatible — missing fields are fine)
  out->dealCount = 0;
  JsonArray dealsArr = doc["topDeals"].as<JsonArray>();
  for (JsonObject deal : dealsArr) {
    if (out->dealCount >= kTbMaxDeals) break;
    TbFlightDeal &d = out->deals[out->dealCount];
    memset(&d, 0, sizeof(d));
    copyField(d.destination, sizeof(d.destination), deal["destination"] | "");
    copyField(d.origin, sizeof(d.origin), deal["origin"] | "");
    copyField(d.currency, sizeof(d.currency), deal["currency"] | "USD");
    d.price = deal["price"] | 0.0f;
    d.dealScore = deal["dealScore"] | 0.0f;
    out->dealCount++;
  }

  // Parse next trip (backward-compatible)
  memset(&out->nextTrip, 0, sizeof(out->nextTrip));
  out->nextTrip.valid = false;
  JsonObject tripObj = doc["nextTrip"].as<JsonObject>();
  if (tripObj) {
    copyField(out->nextTrip.name, sizeof(out->nextTrip.name), tripObj["name"] | "");
    copyField(out->nextTrip.city, sizeof(out->nextTrip.city), tripObj["city"] | "");
    copyField(out->nextTrip.startDate, sizeof(out->nextTrip.startDate), tripObj["startDate"] | "");
    copyField(out->nextTrip.endDate, sizeof(out->nextTrip.endDate), tripObj["endDate"] | "");
    copyField(out->nextTrip.status, sizeof(out->nextTrip.status), tripObj["status"] | "");
    out->nextTrip.valid = out->nextTrip.name[0] != '\0';
  }

  return true;
}

bool fetch_sync_wifi(TbSyncData *out) {
  if (!wifi_manager::connected()) {
    return false;
  }

  const String url = String(TB_API_BASE) + "/api/hardware-sync";
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(url);

  const int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("[sync] HTTP %d from %s\n", code, url.c_str());
    http.end();
    return false;
  }

  const String body = http.getString();
  http.end();

  if (body.isEmpty()) {
    Serial.println("[sync] empty response body");
    return false;
  }

  if (!parse_sync_json(body.c_str(), out)) {
    return false;
  }
  Serial.printf("[sync] OK (WiFi) — %d locations (generated %s)\n", out->count, out->generatedAt);
  return true;
}

bool fetch_sync_usb(TbSyncData *out) {
  static char body[48 * 1024];
  size_t len = 0;
  if (!usb_link::fetch_json(body, sizeof(body), &len, 15000)) {
    return false;
  }
  if (!parse_sync_json(body, out)) {
    return false;
  }
  Serial.printf("[sync] OK (USB) — %d locations (generated %s)\n", out->count, out->generatedAt);
  return true;
}

bool fetch_cover_wifi(const char *location_id, uint8_t **out_rgb, size_t *out_len,
                      TbCoverPump pump) {
  if (!wifi_manager::connected()) {
    return false;
  }
  const String url =
      String(TB_API_BASE) + "/api/hardware-cover?id=" + location_id + "&format=rgb888";
  HTTPClient http;
  http.setTimeout(12000);
  http.begin(url);

  const int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("[cover] HTTP %d for %s\n", code, location_id);
    http.end();
    return false;
  }

  const int len = http.getSize();
  const size_t want = static_cast<size_t>(kCoverImgW) * static_cast<size_t>(kCoverImgH) * 3U;
  if (len > 0 && static_cast<size_t>(len) != want) {
    Serial.printf("[cover] unexpected size %d (want %u)\n", len, static_cast<unsigned>(want));
    http.end();
    return false;
  }

  uint8_t *buf =
      static_cast<uint8_t *>(heap_caps_malloc(want, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (buf == nullptr) {
    http.end();
    return false;
  }

  WiFiClient *stream = http.getStreamPtr();
  size_t got = 0;
  bool aborted = false;
  const uint32_t start = millis();
  while (got < want && (millis() - start) < 12000) {
    // Keep the UI responsive (touch / Close button) while bytes trickle in;
    // pump() returns false if the user closed/changed the detail card.
    if (pump != nullptr && !pump()) {
      aborted = true;
      break;
    }
    if (stream->available()) {
      const int n = stream->readBytes(buf + got, want - got);
      if (n > 0) {
        got += static_cast<size_t>(n);
      }
    } else {
      delay(1);
    }
  }
  http.end();

  if (aborted || got != want) {
    heap_caps_free(buf);
    return false;
  }

  *out_rgb = buf;
  *out_len = want;
  return true;
}

}  // namespace

namespace data_transport {

int mode() { return cfg_mode(); }

bool using_usb() { return s_use_usb; }

void probe() {
  if (s_probed) {
    return;
  }
  s_probed = true;
  const int m = cfg_mode();
  if (m == 1) {
    s_use_usb = true;
    Serial.println("[transport] USB (forced)");
    return;
  }
  if (m == 2) {
    if (usb_link::ping(500)) {
      s_use_usb = true;
      Serial.println("[transport] USB (auto — bridge found)");
      return;
    }
    s_use_usb = false;
    Serial.println("[transport] WiFi (auto — no USB bridge)");
    return;
  }
  s_use_usb = false;
  Serial.println("[transport] WiFi");
}

bool fetch_sync(TbSyncData *out) {
  if (out == nullptr) {
    return false;
  }
  if (s_use_usb) {
    return fetch_sync_usb(out);
  }
  return fetch_sync_wifi(out);
}

bool fetch_cover_rgb888(const char *location_id, uint8_t **out_rgb, size_t *out_len,
                        TbCoverPump pump) {
  if (location_id == nullptr || out_rgb == nullptr || out_len == nullptr) {
    return false;
  }
  if (s_use_usb) {
    // USB path (dev-only) still blocks; pump not threaded through usb_link.
    return usb_link::fetch_binary("COVER", location_id, out_rgb, out_len, 20000);
  }
  return fetch_cover_wifi(location_id, out_rgb, out_len, pump);
}

void release_buffer(void *ptr) { heap_caps_free(ptr); }

}  // namespace data_transport
