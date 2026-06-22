#include "cover_image.h"

#include <esp_heap_caps.h>

namespace {

// Same packing as scripts/generate-world-map.py / world_map.c
static uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return static_cast<uint16_t>(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

}  // namespace

uint16_t *cover_image_from_rgb888(const uint8_t *rgb, size_t pixel_count) {
  if (rgb == nullptr || pixel_count == 0) {
    return nullptr;
  }
  const size_t bytes = pixel_count * sizeof(uint16_t);
  uint16_t *buf = static_cast<uint16_t *>(heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (buf == nullptr) {
    return nullptr;
  }
  for (size_t p = 0; p < pixel_count; ++p) {
    const size_t i = p * 3U;
    buf[p] = rgb565(rgb[i], rgb[i + 1], rgb[i + 2]);
  }
  return buf;
}

void cover_image_release(uint16_t *pixels) {
  if (pixels != nullptr) {
    heap_caps_free(pixels);
  }
}
