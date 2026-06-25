#pragma once

#include <stddef.h>

/**
 * Background network worker pinned to core 0. Fetches wishes + cover images,
 * persists them via wish_store, and exposes lock-free status the UI core polls.
 * It never calls LVGL — the UI core reloads from flash when data_dirty() flips.
 */
namespace net_task {

void begin();  // start the worker (call after wish_store::begin + data_transport::probe)

bool data_dirty();   // new wishes were cached since the last clear_dirty()
void clear_dirty();

bool wifi_connected();
void wifi_ip(char *out, size_t cap);

void request_sync();  // ask the worker to sync as soon as possible

// On-demand cover handoff (all flash/network for covers happens on this task, so
// the UI never touches the filesystem):
void request_cover(const char *id);                 // UI: I want this wish's cover
bool take_cover(const char *id, uint16_t **out);    // UI: ready? takes ownership of the buffer
void cancel_cover();                                 // UI: card closed / moved on

}  // namespace net_task
