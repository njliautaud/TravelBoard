#include "wifi_manager.h"

#include <Arduino.h>
#include <WiFi.h>

#include "config.h"

namespace wifi_manager {

static bool s_connected = false;

bool begin(uint32_t timeout_ms) {
  s_connected = false;

  if (TB_WIFI_SSID[0] == '\0') {
    Serial.println("[wifi] skipped — edit esp32-touch/include/secrets.h");
    return false;
  }

  Serial.printf("[wifi] connecting to \"%s\" …\n", TB_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(TB_WIFI_SSID, TB_WIFI_PASS);

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout_ms) {
    delay(500);
    Serial.printf("[wifi] status=%d …\n", static_cast<int>(WiFi.status()));
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[wifi] connect failed (status=%d)\n", static_cast<int>(WiFi.status()));
    return false;
  }

  s_connected = true;
  Serial.printf("[wifi] connected — IP %s\n", WiFi.localIP().toString().c_str());
  return true;
}

bool connected() { return s_connected && WiFi.status() == WL_CONNECTED; }

const char *ip() {
  static char buf[16] = "—";
  if (!connected()) {
    return buf;
  }
  snprintf(buf, sizeof(buf), "%s", WiFi.localIP().toString().c_str());
  return buf;
}

void loop() {
  if (s_connected && WiFi.status() != WL_CONNECTED) {
    s_connected = false;
    Serial.println("[wifi] disconnected — reconnecting");
    WiFi.reconnect();
  }
}

}  // namespace wifi_manager
