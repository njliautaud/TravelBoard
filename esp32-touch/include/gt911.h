#pragma once

#include <cstdint>

namespace gt911 {

bool init();

/** Poll GT911 over I2C — call every loop() iteration. */
bool poll();

/** Read last poll result — safe from LVGL callback (no I2C). */
void getState(int16_t *x, int16_t *y, bool *pressed);

uint8_t peekStatus();
bool intActive();

}  // namespace gt911
