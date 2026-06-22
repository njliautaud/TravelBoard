#pragma once

#include <stddef.h>
#include <stdint.h>

static constexpr int kCoverImgW = 320;
static constexpr int kCoverImgH = 180;

/**
 * Optional callback polled during a (blocking) cover download so the caller can
 * keep the UI alive / cancel. Still referenced by data_transport's cover fetch,
 * which now only runs on the background network task (so it passes nullptr).
 */
typedef bool (*TbCoverPump)(void);

/** Convert an RGB888 buffer (pixel_count*3 bytes) to a freshly-allocated PSRAM
 *  RGB565 buffer (pixel_count*2 bytes). Free with cover_image_release(). */
uint16_t *cover_image_from_rgb888(const uint8_t *rgb, size_t pixel_count);

/** Free a buffer returned by cover_image_from_rgb888() or wish_store::load_cover(). */
void cover_image_release(uint16_t *pixels);
