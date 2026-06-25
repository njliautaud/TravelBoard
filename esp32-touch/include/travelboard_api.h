#pragma once

#include <stdint.h>

static constexpr int kTbMaxLocations = 64;

struct TbLocation {
  char id[28];
  char name[72];
  char countryCode[4];
  char countryName[48];
  char city[40];
  char region[40];
  char status[12];
  char notes[160];
  double lat;
  double lng;
  bool isDeal;
  bool hasPrice;
  bool hasCover;
  float latestPrice;
  char priceCurrency[8];
};

struct TbSyncData {
  char generatedAt[28];
  int count;
  TbLocation locations[kTbMaxLocations];
};

namespace travelboard_api {

bool fetch(TbSyncData *out);

}  // namespace travelboard_api
