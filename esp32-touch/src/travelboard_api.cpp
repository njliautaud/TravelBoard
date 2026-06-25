#include "travelboard_api.h"

#include "data_transport.h"

namespace travelboard_api {

bool fetch(TbSyncData *out) { return data_transport::fetch_sync(out); }

}  // namespace travelboard_api
