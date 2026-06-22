#include "usb_link.h"

#include <Arduino.h>
#include <esp_heap_caps.h>

namespace {

bool read_line(String *line, uint32_t timeout_ms) {
  const uint32_t start = millis();
  while ((millis() - start) < timeout_ms) {
    if (Serial.available()) {
      *line = Serial.readStringUntil('\n');
      line->trim();
      return true;
    }
    delay(1);
  }
  return false;
}

bool read_exact(uint8_t *dst, size_t want, uint32_t timeout_ms) {
  size_t got = 0;
  const uint32_t start = millis();
  while (got < want && (millis() - start) < timeout_ms) {
    if (Serial.available()) {
      const int n = Serial.readBytes(dst + got, want - got);
      if (n > 0) {
        got += static_cast<size_t>(n);
      }
    } else {
      delay(1);
    }
  }
  return got == want;
}

}  // namespace

namespace usb_link {

bool ping(uint32_t timeout_ms) {
  while (Serial.available()) {
    Serial.read();
  }
  Serial.println("TB?PING");
  Serial.flush();
  String line;
  if (!read_line(&line, timeout_ms)) {
    return false;
  }
  return line == "TB!PONG";
}

bool fetch_json(char *dst, size_t dst_cap, size_t *out_len, uint32_t timeout_ms) {
  if (dst == nullptr || dst_cap == 0 || out_len == nullptr) {
    return false;
  }
  while (Serial.available()) {
    Serial.read();
  }
  Serial.println("TB?SYNC");
  Serial.flush();

  String line;
  if (!read_line(&line, timeout_ms)) {
    Serial.println("[usb] sync header timeout");
    return false;
  }
  if (line.startsWith("TB!ERR")) {
    Serial.printf("[usb] sync err: %s\n", line.c_str());
    return false;
  }
  if (!line.startsWith("TB!SYNC ")) {
    Serial.printf("[usb] bad sync header: %s\n", line.c_str());
    return false;
  }
  const size_t want = static_cast<size_t>(line.substring(8).toInt());
  if (want == 0 || want >= dst_cap) {
    Serial.printf("[usb] sync size %u invalid (cap %u)\n", static_cast<unsigned>(want),
                  static_cast<unsigned>(dst_cap));
    return false;
  }
  if (!read_exact(reinterpret_cast<uint8_t *>(dst), want, timeout_ms)) {
    Serial.println("[usb] sync body timeout");
    return false;
  }
  dst[want] = '\0';
  *out_len = want;
  return true;
}

bool fetch_binary(const char *kind, const char *arg, uint8_t **out_buf, size_t *out_len,
                  uint32_t timeout_ms) {
  if (kind == nullptr || out_buf == nullptr || out_len == nullptr) {
    return false;
  }
  while (Serial.available()) {
    Serial.read();
  }
  if (arg != nullptr && arg[0] != '\0') {
    Serial.printf("TB?%s %s\n", kind, arg);
  } else {
    Serial.printf("TB?%s\n", kind);
  }
  Serial.flush();

  String line;
  if (!read_line(&line, timeout_ms)) {
    Serial.printf("[usb] %s header timeout\n", kind);
    return false;
  }
  if (line.startsWith("TB!ERR")) {
    Serial.printf("[usb] %s err: %s\n", kind, line.c_str());
    return false;
  }
  const String prefix = String("TB!") + kind + " ";
  if (!line.startsWith(prefix)) {
    Serial.printf("[usb] bad %s header: %s\n", kind, line.c_str());
    return false;
  }
  const size_t want = static_cast<size_t>(line.substring(prefix.length()).toInt());
  if (want == 0) {
    return false;
  }
  uint8_t *buf =
      static_cast<uint8_t *>(heap_caps_malloc(want, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (buf == nullptr) {
    Serial.printf("[usb] alloc %u failed\n", static_cast<unsigned>(want));
    return false;
  }
  if (!read_exact(buf, want, timeout_ms)) {
    Serial.printf("[usb] %s body timeout\n", kind);
    heap_caps_free(buf);
    return false;
  }
  *out_buf = buf;
  *out_len = want;
  return true;
}

void release(uint8_t *buf) { heap_caps_free(buf); }

}  // namespace usb_link
