#include "gt911.h"

#include <Arduino.h>
#include <Wire.h>

#include "board_io.hpp"
#include "waveshare_lcd.h"

namespace gt911 {

static constexpr uint16_t kRegProductId = 0x8140;
static constexpr uint16_t kRegConfigVersion = 0x8047;
static constexpr uint16_t kRegResolutionX = 0x8048;
static constexpr uint16_t kRegStatus = 0x814E;
static constexpr uint16_t kRegPointData = 0x814F;

static constexpr int kIntPin = 4;

static uint8_t s_addr = 0x5D;
static int16_t s_x = 0;
static int16_t s_y = 0;
static bool s_pressed = false;

static bool writeReg16(uint16_t reg, const uint8_t *data, size_t len) {
  Wire.beginTransmission(s_addr);
  Wire.write(static_cast<uint8_t>(reg >> 8));
  Wire.write(static_cast<uint8_t>(reg & 0xFF));
  for (size_t i = 0; i < len; ++i) {
    Wire.write(data[i]);
  }
  return Wire.endTransmission() == 0;
}

static bool readReg16(uint16_t reg, uint8_t *data, size_t len) {
  if (len == 0 || len > 255) {
    return false;
  }

  Wire.beginTransmission(s_addr);
  Wire.write(static_cast<uint8_t>(reg >> 8));
  Wire.write(static_cast<uint8_t>(reg & 0xFF));
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  delayMicroseconds(100);

  const uint8_t want = static_cast<uint8_t>(len);
  Wire.requestFrom(s_addr, want);

  size_t i = 0;
  while (Wire.available() && i < len) {
    data[i++] = Wire.read();
  }
  return i == len;
}

static void clearStatus() {
  const uint8_t zero = 0;
  writeReg16(kRegStatus, &zero, 1);
}

static void releaseIntPin() {
  pinMode(kIntPin, INPUT_PULLUP);
}

static void waveshareReset(bool int_level_for_5d) {
  pinMode(kIntPin, OUTPUT);
  digitalWrite(kIntPin, int_level_for_5d ? LOW : HIGH);

  board_io::setPin(board_io::kPinTpRst, false);
  delay(100);

  if (int_level_for_5d) {
    digitalWrite(kIntPin, LOW);
  }
  delay(100);

  board_io::setPin(board_io::kPinTpRst, true);
  delay(200);

  releaseIntPin();
  delay(10);
}

static void flushUntilIdle() {
  for (int i = 0; i < 20; ++i) {
    clearStatus();
    delay(5);
    if (digitalRead(kIntPin) == HIGH) {
      return;
    }
  }
}

static bool probeAddress(uint8_t addr) {
  s_addr = addr;
  uint8_t id[4] = {};
  if (!readReg16(kRegProductId, id, sizeof(id))) {
    return false;
  }
  return id[0] == '9' && id[1] == '1' && id[2] == '1';
}

static void logConfig() {
  uint8_t cfg_ver = 0;
  uint8_t res[4] = {};
  if (readReg16(kRegConfigVersion, &cfg_ver, 1) && readReg16(kRegResolutionX, res, sizeof(res))) {
    const uint16_t max_x = static_cast<uint16_t>(res[0]) | (static_cast<uint16_t>(res[1]) << 8);
    const uint16_t max_y = static_cast<uint16_t>(res[2]) | (static_cast<uint16_t>(res[3]) << 8);
    Serial.printf("[gt911] config v%d, resolution %ux%u\n", cfg_ver, max_x, max_y);
  }
}

static bool pollTouch() {
  uint8_t status = 0;
  if (!readReg16(kRegStatus, &status, 1)) {
    return false;
  }

  const bool buffer_ready = (status & 0x80) != 0;
  if (!buffer_ready) {
    return true;
  }

  const uint8_t points = status & 0x0F;

  if (points > 0 && points <= 5) {
    uint8_t pt[8] = {};
    if (!readReg16(kRegPointData, pt, sizeof(pt))) {
      clearStatus();
      return false;
    }

    const uint16_t raw_x = static_cast<uint16_t>(pt[1]) | (static_cast<uint16_t>(pt[2]) << 8);
    const uint16_t raw_y = static_cast<uint16_t>(pt[3]) | (static_cast<uint16_t>(pt[4]) << 8);

    s_x = static_cast<int16_t>(raw_x);
    s_y = static_cast<int16_t>(raw_y);
    if (s_x >= kLcdWidth) {
      s_x = static_cast<int16_t>(kLcdWidth - 1);
    }
    if (s_y >= kLcdHeight) {
      s_y = static_cast<int16_t>(kLcdHeight - 1);
    }
    s_pressed = true;

    if (Serial) {
      static uint32_t s_last_log_ms = 0;
      const uint32_t now = millis();
      if (now - s_last_log_ms > 500) {
        s_last_log_ms = now;
        Serial.printf("[gt911] touch %d,%d\n", s_x, s_y);
      }
    }
  } else {
    s_pressed = false;
  }

  clearStatus();
  return true;
}

bool init() {
  Wire.setTimeOut(100);
  Wire.setClock(100000);

  s_pressed = false;
  s_x = 0;
  s_y = 0;

  waveshareReset(true);
  if (probeAddress(0x5D)) {
    Serial.println("[gt911] found at 0x5D");
    logConfig();
    flushUntilIdle();
    Serial.printf("[gt911] post-init status=0x%02x int=%d\n", peekStatus(), intActive() ? 1 : 0);
    return true;
  }

  waveshareReset(false);
  if (probeAddress(0x14)) {
    Serial.println("[gt911] found at 0x14");
    logConfig();
    flushUntilIdle();
    Serial.printf("[gt911] post-init status=0x%02x int=%d\n", peekStatus(), intActive() ? 1 : 0);
    return true;
  }

  Serial.println("[gt911] ERROR: not detected on I2C");
  return false;
}

uint8_t peekStatus() {
  uint8_t status = 0;
  if (!readReg16(kRegStatus, &status, 1)) {
    return 0xFF;
  }
  return status;
}

bool intActive() { return digitalRead(kIntPin) == LOW; }

bool poll() { return pollTouch(); }

void getState(int16_t *x, int16_t *y, bool *pressed) {
  if (x != nullptr) {
    *x = s_x;
  }
  if (y != nullptr) {
    *y = s_y;
  }
  if (pressed != nullptr) {
    *pressed = s_pressed;
  }
}

}  // namespace gt911
