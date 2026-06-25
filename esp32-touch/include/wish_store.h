#pragma once

#include <stddef.h>
#include <stdint.h>

#include "travelboard_api.h"

/**
 * On-device persistence (LittleFS). Wishes are stored as a single binary blob;
 * cover images as raw RGB565 files keyed by a hash of the location id. All calls
 * are mutex-guarded so the UI core (reads) and the network core (writes) can
 * share the filesystem safely.
 */
namespace wish_store {

bool begin();  // mount LittleFS (formats on first run); call once at boot

bool load_wishes(TbSyncData *out);
bool save_wishes(const TbSyncData *data);

bool has_cover(const char *id);
/** Read a cached cover into a fresh PSRAM buffer; free with cover_image_release(). */
bool load_cover(const char *id, uint16_t **out_pixels);
bool save_cover(const char *id, const uint16_t *pixels, size_t bytes);

}  // namespace wish_store
