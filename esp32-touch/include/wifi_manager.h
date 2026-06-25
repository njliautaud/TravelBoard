#pragma once

#include <stdint.h>

namespace wifi_manager {

bool begin(uint32_t timeout_ms);
bool connected();
const char *ip();
void loop();

}  // namespace wifi_manager
