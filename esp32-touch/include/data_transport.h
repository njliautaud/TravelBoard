#pragma once

#include <stddef.h>
#include <stdint.h>

#include "cover_image.h"
#include "travelboard_api.h"

namespace data_transport {

/** 0=WiFi, 1=USB serial, 2=auto (USB if bridge answers ping). */
int mode();

/** Active path after boot (auto may pick USB). */
bool using_usb();

/** Probe USB bridge when mode is auto; call once after Serial.begin. */
void probe();

bool fetch_sync(TbSyncData *out);

/** Fetch cover as RGB888 in PSRAM. Caller must data_transport::release_buffer().
 *  pump (may be nullptr) is polled during the download; return false to abort. */
bool fetch_cover_rgb888(const char *location_id, uint8_t **out_rgb, size_t *out_len,
                        TbCoverPump pump);

void release_buffer(void *ptr);

}  // namespace data_transport
