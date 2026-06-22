#pragma once

#include "travelboard_api.h"

void ui_travelboard_init();
void ui_travelboard_loop();
void ui_travelboard_set_wifi(bool connected, const char *ip);
void ui_travelboard_set_sync_message(const char *message);
void ui_travelboard_apply_data(const TbSyncData *data);
