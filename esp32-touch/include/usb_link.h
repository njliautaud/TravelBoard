#pragma once

#include <stddef.h>
#include <stdint.h>

namespace usb_link {

bool ping(uint32_t timeout_ms = 400);
bool fetch_json(char *dst, size_t dst_cap, size_t *out_len, uint32_t timeout_ms = 15000);
bool fetch_binary(const char *kind, const char *arg, uint8_t **out_buf, size_t *out_len,
                  uint32_t timeout_ms = 20000);
void release(uint8_t *buf);

}  // namespace usb_link
