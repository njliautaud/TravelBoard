/**
 * Waveshare ESP32-S3-Touch-LCD-7B IO expander (I2C 0x24).
 *
 * NOT the CH422G used on older Waveshare boards — the 7B uses a register-based
 * expander at a single I2C address. Protocol from Waveshare rgb_lcd demo.
 */
#pragma once

#include <Wire.h>

namespace board_io {

static constexpr uint8_t kAddr        = 0x24;
static constexpr uint8_t kRegMode     = 0x02;
static constexpr uint8_t kRegOutput   = 0x03;

static constexpr uint8_t kPinTpRst      = 1;
static constexpr uint8_t kPinBacklight = 2;
static constexpr uint8_t kPinLcdRst   = 3;
static constexpr uint8_t kPinSdCs     = 4;
static constexpr uint8_t kPinUsbSel   = 5; /* 0 = USB/UART, 1 = CAN */
static constexpr uint8_t kPinLcdVdd   = 6; /* 7B LCD VCOM / VDD enable */

static uint8_t s_shadow = 0xFF;

inline void writeReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(kAddr);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

inline void writeOutputs(uint8_t value) {
  s_shadow = value;
  writeReg(kRegOutput, value);
}

inline void setPin(uint8_t pin, bool high) {
  if (high) {
    s_shadow |= static_cast<uint8_t>(1u << pin);
  } else {
    s_shadow &= static_cast<uint8_t>(~(1u << pin));
  }
  writeOutputs(s_shadow);
}

/** Match Waveshare IO_EXTENSION_Init() + backlight on + USB-UART mode. */
inline void init() {
  Wire.begin(8, 9);
  Wire.setClock(400000);
  delay(10);

  writeReg(kRegMode, 0xFF); /* all pins output */
  s_shadow = 0xFF;
  writeOutputs(s_shadow);

  setPin(kPinUsbSel, false); /* UART port active */
  setPin(kPinBacklight, true);
  setPin(kPinLcdVdd, true);
  setPin(kPinSdCs, true);
  setPin(kPinLcdRst, true);
  setPin(kPinTpRst, true);
  delay(50);
}

inline void backlightOn() { setPin(kPinBacklight, true); }

}  // namespace board_io
