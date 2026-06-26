#pragma once

#include <stdint.h>

static constexpr int kTbMaxLocations = 64;
static constexpr int kTbMaxDeals = 3;

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

struct TbFlightDeal {
  char destination[48];
  char origin[8];
  char currency[8];
  float price;
  float dealScore;
};

struct TbNextTrip {
  char name[72];
  char city[48];
  char startDate[28];
  char endDate[28];
  char status[12];
  bool valid;  // false if no upcoming trip
};

struct TbSyncData {
  char generatedAt[28];
  int count;
  TbLocation locations[kTbMaxLocations];
  // Flight deals and next trip (backward-compatible: zero-initialized = no data)
  int dealCount;
  TbFlightDeal deals[kTbMaxDeals];
  TbNextTrip nextTrip;
};

namespace travelboard_api {

bool fetch(TbSyncData *out);

}  // namespace travelboard_api
