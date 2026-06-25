#include "ui_travelboard.h"

#include <Arduino.h>
#include <lvgl.h>
#include <string.h>

#include "travelboard_api.h"
#include "app_lvgl.h"
#include "cover_image.h"
#include "net_task.h"
#include "waveshare_lcd.h"
#include "world_map.h"

namespace {

static constexpr int32_t kSidebarW = 280;
static constexpr int32_t kStatusH = 36;
static constexpr int32_t kPinDot = 14;
static constexpr int32_t kPinHit = 40;

enum class StatusFilter { ToVisit, Visited };

static const lv_color_t kColorBg = lv_color_hex(0x0b1120);
static const lv_color_t kColorSidebar = lv_color_hex(0x0f172a);
static const lv_color_t kColorMap = lv_color_hex(0x111827);
static const lv_color_t kColorAmber = lv_color_hex(0xfbbf24);
static const lv_color_t kColorEmerald = lv_color_hex(0x34d399);
static const lv_color_t kColorRose = lv_color_hex(0xfb7185);
static const lv_color_t kColorText = lv_color_hex(0xe2e8f0);
static const lv_color_t kColorMuted = lv_color_hex(0x94a3b8);

static TbSyncData g_data = {};
static StatusFilter g_filter = StatusFilter::ToVisit;
static lv_obj_t *g_root = nullptr;
static lv_obj_t *g_sidebar = nullptr;
static lv_obj_t *g_list = nullptr;
static lv_obj_t *g_map = nullptr;
static lv_obj_t *g_map_img = nullptr;
static lv_obj_t *g_pins_layer = nullptr;
static lv_obj_t *g_wifi_label = nullptr;
static lv_obj_t *g_sync_label = nullptr;
static lv_obj_t *g_filter_btn = nullptr;
static lv_obj_t *g_filter_btn_lbl = nullptr;
static lv_obj_t *g_page_label = nullptr;
static lv_obj_t *g_btn_prev = nullptr;
static lv_obj_t *g_btn_next = nullptr;
static int g_page = 0;
static constexpr int kItemsPerPage = 6;
static lv_obj_t *g_detail_overlay = nullptr;
static lv_obj_t *g_detail_card = nullptr;
static lv_obj_t *g_detail_scroll = nullptr;
static lv_obj_t *g_detail_cover = nullptr;
static lv_obj_t *g_detail_name = nullptr;
static lv_obj_t *g_detail_status = nullptr;
static lv_obj_t *g_detail_place_val = nullptr;
static lv_obj_t *g_detail_country_val = nullptr;
static lv_obj_t *g_detail_deal_val = nullptr;
static lv_obj_t *g_detail_notes_val = nullptr;
static lv_obj_t *g_detail_coords_val = nullptr;
static lv_obj_t *g_detail_place_row = nullptr;
static lv_obj_t *g_detail_country_row = nullptr;
static lv_obj_t *g_detail_deal_row = nullptr;
static lv_obj_t *g_detail_notes_row = nullptr;
static lv_obj_t *g_pins[kTbMaxLocations] = {};
static uint16_t *g_cover_pixels = nullptr;
static lv_img_dsc_t g_cover_dsc = {};
static int g_pending_cover_index = -1;
static uint32_t g_cover_deadline_ms = 0;

static int32_t mapWidth() { return kLcdWidth - kSidebarW; }
static int32_t mapHeight() { return kLcdHeight - kStatusH; }

static void rebuildList();
static void rebuildPins();

static bool isVisited(const TbLocation &loc) {
  return strncmp(loc.status, "VISITED", 8) == 0;
}

static bool passesFilter(const TbLocation &loc) {
  return g_filter == StatusFilter::Visited ? isVisited(loc) : !isVisited(loc);
}

static void updateSyncLabel() {
  int shown = 0;
  for (int i = 0; i < g_data.count; ++i) {
    if (passesFilter(g_data.locations[i])) {
      shown++;
    }
  }
  char msg[56];
  snprintf(msg, sizeof(msg), "Sync: %d/%d", shown, g_data.count);
  ui_travelboard_set_sync_message(msg);
}

static void updateFilterBtnLabel() {
  if (g_filter_btn_lbl == nullptr) {
    return;
  }
  lv_label_set_text(g_filter_btn_lbl,
                    g_filter == StatusFilter::Visited ? "Visited" : "To visit");
}

static void clearCoverImage() {
  g_pending_cover_index = -1;
  if (g_detail_cover != nullptr) {
    lv_img_cache_invalidate_src(g_cover_pixels != nullptr ? &g_cover_dsc : nullptr);
    lv_img_set_src(g_detail_cover, nullptr);
    lv_obj_add_flag(g_detail_cover, LV_OBJ_FLAG_HIDDEN);
  }
  if (g_cover_pixels != nullptr) {
    cover_image_release(g_cover_pixels);
    g_cover_pixels = nullptr;
  }
}

static void applyCoverPixels(uint16_t *pixels) {
  if (g_detail_cover == nullptr) {
    if (pixels != nullptr) {
      cover_image_release(pixels);
    }
    return;
  }
  if (g_cover_pixels != nullptr) {
    lv_img_cache_invalidate_src(&g_cover_dsc);
    lv_img_set_src(g_detail_cover, nullptr);
    cover_image_release(g_cover_pixels);
    g_cover_pixels = nullptr;
  }
  g_cover_pixels = pixels;
  if (pixels == nullptr) {
    lv_obj_add_flag(g_detail_cover, LV_OBJ_FLAG_HIDDEN);
    return;
  }
  g_cover_dsc.header.cf = LV_IMG_CF_TRUE_COLOR;
  g_cover_dsc.header.w = kCoverImgW;
  g_cover_dsc.header.h = kCoverImgH;
  g_cover_dsc.data_size = static_cast<uint32_t>(kCoverImgW * kCoverImgH * 2);
  g_cover_dsc.data = reinterpret_cast<const uint8_t *>(pixels);
  lv_img_set_src(g_detail_cover, &g_cover_dsc);
  lv_obj_clear_flag(g_detail_cover, LV_OBJ_FLAG_HIDDEN);
}

static void onFilterToggle(lv_event_t *e) {
  (void)e;
  g_filter = g_filter == StatusFilter::ToVisit ? StatusFilter::Visited : StatusFilter::ToVisit;
  g_page = 0;
  updateFilterBtnLabel();
  rebuildList();
  rebuildPins();
  updateSyncLabel();
  app_lvgl_invalidate(g_list);
  app_lvgl_invalidate(g_pins_layer);
  app_lvgl_refresh_now();
}

static lv_color_t pinColor(const TbLocation &loc) {
  if (strncmp(loc.status, "VISITED", 8) == 0) {
    return kColorEmerald;
  }
  return kColorAmber;
}

static void latLngToMap(int32_t *x, int32_t *y, double lat, double lng) {
  const int32_t w = mapWidth();
  const int32_t h = mapHeight();
  *x = static_cast<int32_t>((lng + 180.0) / 360.0 * static_cast<double>(w));
  *y = static_cast<int32_t>((90.0 - lat) / 180.0 * static_cast<double>(h));
  if (*x < kPinHit / 2) {
    *x = kPinHit / 2;
  }
  if (*x > w - kPinHit / 2) {
    *x = w - kPinHit / 2;
  }
  if (*y < kPinHit / 2) {
    *y = kPinHit / 2;
  }
  if (*y > h - kPinHit / 2) {
    *y = h - kPinHit / 2;
  }
}

static void stylePanel(lv_obj_t *obj, lv_color_t bg) {
  lv_obj_remove_style_all(obj);
  lv_obj_set_style_bg_color(obj, bg, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(obj, 0, LV_PART_MAIN);
}

static void hideDetail() {
  if (g_detail_overlay != nullptr) {
    clearCoverImage();
    lv_obj_add_flag(g_detail_overlay, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(g_detail_overlay, LV_OBJ_FLAG_CLICKABLE);
    app_lvgl_invalidate(g_detail_overlay);
    app_lvgl_refresh_now();
  }
}

static void closeDetail(lv_event_t *e) {
  (void)e;
  hideDetail();
}

static void stopCardClick(lv_event_t *e) {
  lv_event_stop_bubbling(e);
}

static void styleCaption(lv_obj_t *lbl) {
  lv_obj_set_style_text_color(lbl, kColorMuted, LV_PART_MAIN);
  lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, LV_PART_MAIN);
}

static lv_obj_t *addFieldRow(lv_obj_t *parent, const char *caption, lv_obj_t **value_out) {
  lv_obj_t *row = lv_obj_create(parent);
  lv_obj_remove_style_all(row);
  lv_obj_set_width(row, LV_PCT(100));
  lv_obj_set_height(row, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(row, 6, LV_PART_MAIN);
  lv_obj_clear_flag(row, LV_OBJ_FLAG_CLICKABLE);

  lv_obj_t *cap = lv_label_create(row);
  lv_label_set_text(cap, caption);
  styleCaption(cap);

  lv_obj_t *val = lv_label_create(row);
  lv_obj_set_width(val, LV_PCT(100));
  lv_label_set_long_mode(val, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_color(val, kColorText, LV_PART_MAIN);
  lv_obj_set_style_text_font(val, &lv_font_montserrat_14, LV_PART_MAIN);
  if (value_out != nullptr) {
    *value_out = val;
  }
  return row;
}

static void setRowVisible(lv_obj_t *row, bool visible) {
  if (row == nullptr) {
    return;
  }
  if (visible) {
    lv_obj_clear_flag(row, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_obj_add_flag(row, LV_OBJ_FLAG_HIDDEN);
  }
}

static void setFieldText(lv_obj_t *row, lv_obj_t *val_lbl, const char *text, bool visible) {
  if (val_lbl == nullptr) {
    return;
  }
  if (!visible || text == nullptr || text[0] == '\0') {
    setRowVisible(row, false);
    return;
  }
  lv_label_set_text(val_lbl, text);
  setRowVisible(row, true);
}

static void showDetail(int index) {
  if (index < 0 || index >= g_data.count || g_detail_overlay == nullptr) {
    return;
  }

  const TbLocation &loc = g_data.locations[index];
  const bool visited = strncmp(loc.status, "VISITED", 8) == 0;

  lv_label_set_text(g_detail_name, loc.name);
  lv_label_set_text(g_detail_status, visited ? "Visited" : "To visit");
  lv_obj_set_style_text_color(g_detail_status, visited ? kColorEmerald : kColorAmber, LV_PART_MAIN);

  char place_buf[96];
  place_buf[0] = '\0';
  if (loc.city[0] != '\0' || loc.region[0] != '\0') {
    if (loc.city[0] != '\0' && loc.region[0] != '\0') {
      snprintf(place_buf, sizeof(place_buf), "%s, %s", loc.city, loc.region);
    } else if (loc.city[0] != '\0') {
      snprintf(place_buf, sizeof(place_buf), "%s", loc.city);
    } else {
      snprintf(place_buf, sizeof(place_buf), "%s", loc.region);
    }
  }
  setFieldText(g_detail_place_row, g_detail_place_val, place_buf, place_buf[0] != '\0');

  char country_buf[72];
  if (loc.countryName[0] != '\0') {
    snprintf(country_buf, sizeof(country_buf), "%s  ·  %s", loc.countryName, loc.countryCode);
  } else {
    snprintf(country_buf, sizeof(country_buf), "%s", loc.countryCode);
  }
  setFieldText(g_detail_country_row, g_detail_country_val, country_buf, true);

  char deal_buf[72];
  deal_buf[0] = '\0';
  if (loc.isDeal) {
    if (loc.hasPrice) {
      snprintf(deal_buf, sizeof(deal_buf), "Flight deal  ·  %.0f %s", loc.latestPrice,
               loc.priceCurrency);
    } else {
      snprintf(deal_buf, sizeof(deal_buf), "Flight deal");
    }
  }
  setFieldText(g_detail_deal_row, g_detail_deal_val, deal_buf, deal_buf[0] != '\0');
  if (deal_buf[0] != '\0') {
    lv_obj_set_style_text_color(g_detail_deal_val, kColorRose, LV_PART_MAIN);
  }

  setFieldText(g_detail_notes_row, g_detail_notes_val, loc.notes, loc.notes[0] != '\0');

  char coord_buf[72];
  snprintf(coord_buf, sizeof(coord_buf), "%.4f, %.4f", loc.lat, loc.lng);
  lv_label_set_text(g_detail_coords_val, coord_buf);

  lv_obj_update_layout(g_detail_card);
  lv_obj_clear_flag(g_detail_overlay, LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_flag(g_detail_overlay, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_move_foreground(g_detail_overlay);
  if (loc.hasCover) {
    g_pending_cover_index = index;
    g_cover_next_try_ms = 0;                  // poll the cache immediately
    g_cover_deadline_ms = millis() + 20000;   // give the background task time to fetch
    lv_obj_add_flag(g_detail_cover, LV_OBJ_FLAG_HIDDEN);  // revealed once loaded
    lv_img_set_src(g_detail_cover, nullptr);
  } else {
    clearCoverImage();
  }
  app_lvgl_invalidate(g_detail_overlay);
  app_lvgl_refresh_now();
}

static void onLocationSelected(lv_event_t *e) {
  const lv_event_code_t code = lv_event_get_code(e);
  if (code != LV_EVENT_SHORT_CLICKED && code != LV_EVENT_CLICKED) {
    return;
  }
  const intptr_t index = reinterpret_cast<intptr_t>(lv_event_get_user_data(e));
  showDetail(static_cast<int>(index));
}

static void bindClickTarget(lv_obj_t *obj, int index) {
  lv_obj_add_event_cb(obj, onLocationSelected, LV_EVENT_SHORT_CLICKED,
                      reinterpret_cast<void *>(static_cast<intptr_t>(index)));
  lv_obj_add_event_cb(obj, onLocationSelected, LV_EVENT_CLICKED,
                      reinterpret_cast<void *>(static_cast<intptr_t>(index)));
}

static void clearPins() {
  for (int i = 0; i < kTbMaxLocations; ++i) {
    if (g_pins[i] != nullptr) {
      lv_obj_del(g_pins[i]);
      g_pins[i] = nullptr;
    }
  }
}

static int filteredCount() {
  int n = 0;
  for (int i = 0; i < g_data.count; ++i) {
    if (passesFilter(g_data.locations[i])) {
      n++;
    }
  }
  return n;
}

static int pageCount() {
  const int pages = (filteredCount() + kItemsPerPage - 1) / kItemsPerPage;
  return pages < 1 ? 1 : pages;
}

static void updateNav() {
  const int pages = pageCount();
  if (g_page_label != nullptr) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%d / %d", g_page + 1, pages);
    lv_label_set_text(g_page_label, buf);
  }
  // Dim the arrows that can't move further.
  if (g_btn_prev != nullptr) {
    lv_obj_set_style_opa(g_btn_prev, g_page > 0 ? LV_OPA_COVER : LV_OPA_40, LV_PART_MAIN);
  }
  if (g_btn_next != nullptr) {
    lv_obj_set_style_opa(g_btn_next, g_page < pages - 1 ? LV_OPA_COVER : LV_OPA_40, LV_PART_MAIN);
  }
}

static void rebuildList() {
  if (g_list == nullptr) {
    return;
  }
  lv_obj_clean(g_list);

  if (g_data.count == 0) {
    lv_obj_t *empty = lv_label_create(g_list);
    lv_label_set_text(empty, "No wishes yet.\nSync when server is running.");
    lv_obj_set_style_text_color(empty, kColorMuted, LV_PART_MAIN);
    lv_obj_set_style_text_align(empty, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_set_width(empty, kSidebarW - 24);
    lv_label_set_long_mode(empty, LV_LABEL_LONG_WRAP);
    updateNav();
    return;
  }

  // Clamp the page to the current filtered range.
  const int pages = pageCount();
  if (g_page >= pages) {
    g_page = pages - 1;
  }
  if (g_page < 0) {
    g_page = 0;
  }
  const int start = g_page * kItemsPerPage;
  const int end = start + kItemsPerPage;

  int fidx = 0;  // position among items passing the filter
  bool any = false;
  for (int i = 0; i < g_data.count; ++i) {
    const TbLocation &loc = g_data.locations[i];
    if (!passesFilter(loc)) {
      continue;
    }
    const int pos = fidx++;
    if (pos < start || pos >= end) {
      continue;  // not on this page
    }
    any = true;

    lv_obj_t *btn = lv_btn_create(g_list);
    lv_obj_set_width(btn, kSidebarW - 16);
    lv_obj_set_height(btn, LV_SIZE_CONTENT);
    lv_obj_set_style_bg_color(btn, kColorBg, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_radius(btn, 8, LV_PART_MAIN);
    lv_obj_set_style_pad_all(btn, 10, LV_PART_MAIN);
    bindClickTarget(btn, i);

    lv_obj_t *row = lv_obj_create(btn);
    lv_obj_remove_style_all(row);
    lv_obj_set_size(row, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(row, 4, LV_PART_MAIN);
    lv_obj_clear_flag(row, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t *name = lv_label_create(row);
    lv_label_set_text(name, loc.name);
    lv_obj_set_style_text_color(name, kColorText, LV_PART_MAIN);
    lv_obj_set_width(name, kSidebarW - 40);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);

    char meta[64];
    if (loc.isDeal) {
      snprintf(meta, sizeof(meta), "%s · deal", loc.countryCode);
    } else {
      snprintf(meta, sizeof(meta), "%s · %s", loc.countryCode,
               strncmp(loc.status, "VISITED", 8) == 0 ? "visited" : "to visit");
    }
    lv_obj_t *sub = lv_label_create(row);
    lv_label_set_text(sub, meta);
    lv_obj_set_style_text_color(sub, loc.isDeal ? kColorRose : kColorMuted, LV_PART_MAIN);
  }
  if (!any) {
    lv_obj_t *empty = lv_label_create(g_list);
    lv_label_set_text(empty, g_filter == StatusFilter::Visited ? "No visited wishes." : "No to-visit wishes.");
    lv_obj_set_style_text_color(empty, kColorMuted, LV_PART_MAIN);
    lv_obj_set_style_text_align(empty, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_set_width(empty, kSidebarW - 24);
    lv_label_set_long_mode(empty, LV_LABEL_LONG_WRAP);
  }
  updateNav();
}

static void changePage(int delta) {
  const int pages = pageCount();
  int next = g_page + delta;
  if (next < 0) {
    next = 0;
  }
  if (next > pages - 1) {
    next = pages - 1;
  }
  if (next == g_page) {
    return;
  }
  g_page = next;
  rebuildList();
  app_lvgl_invalidate(g_sidebar);
  app_lvgl_refresh_now();
}

static void onPagePrev(lv_event_t *e) {
  (void)e;
  changePage(-1);
}

static void onPageNext(lv_event_t *e) {
  (void)e;
  changePage(1);
}

static void createPin(int index, const TbLocation &loc) {
  int32_t px = 0;
  int32_t py = 0;
  latLngToMap(&px, &py, loc.lat, loc.lng);

  lv_obj_t *hit = lv_btn_create(g_pins_layer);
  g_pins[index] = hit;
  lv_obj_remove_style_all(hit);
  lv_obj_set_size(hit, kPinHit, kPinHit);
  lv_obj_set_style_bg_opa(hit, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(hit, 0, LV_PART_MAIN);
  lv_obj_set_style_shadow_width(hit, 0, LV_PART_MAIN);
  lv_obj_set_style_outline_width(hit, 0, LV_PART_MAIN);
  lv_obj_set_pos(hit, px - kPinHit / 2, py - kPinHit / 2);
  bindClickTarget(hit, index);

  lv_obj_t *dot = lv_obj_create(hit);
  lv_obj_remove_style_all(dot);
  lv_obj_set_size(dot, kPinDot, kPinDot);
  lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, LV_PART_MAIN);
  lv_obj_set_style_bg_color(dot, pinColor(loc), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, LV_PART_MAIN);
  if (loc.isDeal) {
    lv_obj_set_style_border_color(dot, kColorRose, LV_PART_MAIN);
    lv_obj_set_style_border_width(dot, 3, LV_PART_MAIN);
  }
  lv_obj_center(dot);
  lv_obj_clear_flag(dot, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_move_foreground(hit);
}

static void rebuildPins() {
  if (g_pins_layer == nullptr) {
    return;
  }
  clearPins();

  for (int i = 0; i < g_data.count; ++i) {
    if (!passesFilter(g_data.locations[i])) {
      continue;
    }
    createPin(i, g_data.locations[i]);
  }
}

static void buildDetailOverlay() {
  g_detail_overlay = lv_obj_create(g_root);
  lv_obj_remove_style_all(g_detail_overlay);
  lv_obj_set_size(g_detail_overlay, kLcdWidth, kLcdHeight);
  lv_obj_set_style_bg_color(g_detail_overlay, lv_color_hex(0x05080f), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(g_detail_overlay, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_add_flag(g_detail_overlay, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(g_detail_overlay, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(g_detail_overlay, closeDetail, LV_EVENT_CLICKED, nullptr);

  g_detail_card = lv_obj_create(g_detail_overlay);
  stylePanel(g_detail_card, kColorSidebar);
  lv_obj_set_size(g_detail_card, 800, 540);
  lv_obj_center(g_detail_card);
  lv_obj_set_style_radius(g_detail_card, 16, LV_PART_MAIN);
  lv_obj_set_style_border_color(g_detail_card, lv_color_hex(0x334155), LV_PART_MAIN);
  lv_obj_set_style_border_width(g_detail_card, 1, LV_PART_MAIN);
  lv_obj_set_style_pad_all(g_detail_card, 24, LV_PART_MAIN);
  lv_obj_set_style_pad_row(g_detail_card, 12, LV_PART_MAIN);
  lv_obj_set_flex_flow(g_detail_card, LV_FLEX_FLOW_COLUMN);
  lv_obj_clear_flag(g_detail_card, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_event_cb(g_detail_card, stopCardClick, LV_EVENT_CLICKED, nullptr);

  g_detail_scroll = lv_obj_create(g_detail_card);
  stylePanel(g_detail_scroll, kColorSidebar);
  lv_obj_set_width(g_detail_scroll, LV_PCT(100));
  lv_obj_set_flex_grow(g_detail_scroll, 1);
  lv_obj_set_flex_flow(g_detail_scroll, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(g_detail_scroll, 12, LV_PART_MAIN);
  lv_obj_set_style_pad_left(g_detail_scroll, 0, LV_PART_MAIN);
  lv_obj_add_flag(g_detail_scroll, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(g_detail_scroll, LV_DIR_VER);
  lv_obj_set_scrollbar_mode(g_detail_scroll, LV_SCROLLBAR_MODE_OFF);

  g_detail_cover = lv_img_create(g_detail_scroll);
  lv_obj_set_size(g_detail_cover, kCoverImgW, kCoverImgH);
  lv_obj_set_style_pad_all(g_detail_cover, 0, LV_PART_MAIN);
  lv_obj_set_style_border_width(g_detail_cover, 0, LV_PART_MAIN);
  lv_obj_set_style_radius(g_detail_cover, 0, LV_PART_MAIN);
  lv_obj_set_style_clip_corner(g_detail_cover, false, LV_PART_MAIN);
  lv_obj_add_flag(g_detail_cover, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(g_detail_cover, LV_OBJ_FLAG_CLICKABLE);

  g_detail_name = lv_label_create(g_detail_scroll);
  lv_obj_set_width(g_detail_name, LV_PCT(100));
  lv_label_set_long_mode(g_detail_name, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_color(g_detail_name, kColorText, LV_PART_MAIN);
  lv_obj_set_style_text_font(g_detail_name, &lv_font_montserrat_24, LV_PART_MAIN);

  g_detail_status = lv_label_create(g_detail_scroll);
  lv_obj_set_width(g_detail_status, LV_PCT(100));
  lv_obj_set_style_text_color(g_detail_status, kColorAmber, LV_PART_MAIN);
  lv_obj_set_style_text_font(g_detail_status, &lv_font_montserrat_14, LV_PART_MAIN);

  lv_obj_t *divider = lv_obj_create(g_detail_scroll);
  lv_obj_remove_style_all(divider);
  lv_obj_set_size(divider, LV_PCT(100), 2);
  lv_obj_set_style_bg_color(divider, lv_color_hex(0x334155), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(divider, LV_OPA_COVER, LV_PART_MAIN);

  g_detail_place_row = addFieldRow(g_detail_scroll, "LOCATION", &g_detail_place_val);
  g_detail_country_row = addFieldRow(g_detail_scroll, "COUNTRY", &g_detail_country_val);
  g_detail_deal_row = addFieldRow(g_detail_scroll, "DEAL", &g_detail_deal_val);
  g_detail_notes_row = addFieldRow(g_detail_scroll, "NOTES", &g_detail_notes_val);

  lv_obj_t *coord_row = lv_obj_create(g_detail_scroll);
  lv_obj_remove_style_all(coord_row);
  lv_obj_set_width(coord_row, LV_PCT(100));
  lv_obj_set_height(coord_row, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(coord_row, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(coord_row, 6, LV_PART_MAIN);
  lv_obj_t *coord_cap = lv_label_create(coord_row);
  lv_label_set_text(coord_cap, "COORDINATES");
  styleCaption(coord_cap);
  g_detail_coords_val = lv_label_create(coord_row);
  lv_obj_set_width(g_detail_coords_val, LV_PCT(100));
  lv_obj_set_style_text_color(g_detail_coords_val, kColorMuted, LV_PART_MAIN);

  lv_obj_t *close_btn = lv_btn_create(g_detail_card);
  lv_obj_set_size(close_btn, 180, 52);
  lv_obj_set_style_bg_color(close_btn, kColorAmber, LV_PART_MAIN);
  lv_obj_set_style_radius(close_btn, 10, LV_PART_MAIN);
  lv_obj_add_event_cb(close_btn, closeDetail, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *close_lbl = lv_label_create(close_btn);
  lv_label_set_text(close_lbl, "Close");
  lv_obj_set_style_text_color(close_lbl, lv_color_hex(0x0b1120), LV_PART_MAIN);
  lv_obj_set_style_text_font(close_lbl, &lv_font_montserrat_14, LV_PART_MAIN);
  lv_obj_center(close_lbl);
}

static bool dataEqual(const TbSyncData *a, const TbSyncData *b) {
  if (a == nullptr || b == nullptr) {
    return false;
  }
  if (a->count != b->count) {
    return false;
  }
  return memcmp(a->locations, b->locations, static_cast<size_t>(a->count) * sizeof(TbLocation)) == 0;
}

}  // namespace

void ui_travelboard_init() {
  g_root = lv_scr_act();
  stylePanel(g_root, kColorBg);

  lv_obj_t *row = lv_obj_create(g_root);
  stylePanel(row, kColorBg);
  lv_obj_set_size(row, kLcdWidth, kLcdHeight);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
  lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);

  g_sidebar = lv_obj_create(row);
  stylePanel(g_sidebar, kColorSidebar);
  lv_obj_set_width(g_sidebar, kSidebarW);
  lv_obj_set_height(g_sidebar, kLcdHeight);
  lv_obj_set_style_pad_hor(g_sidebar, 8, LV_PART_MAIN);
  lv_obj_set_style_pad_top(g_sidebar, 12, LV_PART_MAIN);
  lv_obj_set_flex_flow(g_sidebar, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(g_sidebar, 8, LV_PART_MAIN);
  lv_obj_clear_flag(g_sidebar, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *title = lv_label_create(g_sidebar);
  lv_label_set_text(title, "TravelBoard");
  lv_obj_set_style_text_color(title, kColorAmber, LV_PART_MAIN);

  lv_obj_t *hint = lv_label_create(g_sidebar);
  lv_label_set_text(hint, "Tap map or list");
  lv_obj_set_style_text_color(hint, kColorMuted, LV_PART_MAIN);

  g_list = lv_obj_create(g_sidebar);
  stylePanel(g_list, kColorSidebar);
  lv_obj_set_width(g_list, kSidebarW - 16);
  lv_obj_set_flex_grow(g_list, 1);  // fill the space above the page-nav row
  lv_obj_set_flex_flow(g_list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(g_list, 6, LV_PART_MAIN);
  // Paged list: no scrolling — the up/down buttons page through fixed chunks.
  lv_obj_clear_flag(g_list, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *nav = lv_obj_create(g_sidebar);
  stylePanel(nav, kColorSidebar);
  lv_obj_set_width(nav, kSidebarW - 16);
  lv_obj_set_height(nav, 52);
  lv_obj_set_flex_flow(nav, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(nav, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER,
                        LV_FLEX_ALIGN_CENTER);
  lv_obj_clear_flag(nav, LV_OBJ_FLAG_SCROLLABLE);

  g_btn_prev = lv_btn_create(nav);
  lv_obj_set_size(g_btn_prev, 72, 44);
  lv_obj_set_style_bg_color(g_btn_prev, kColorBg, LV_PART_MAIN);
  lv_obj_set_style_border_color(g_btn_prev, kColorAmber, LV_PART_MAIN);
  lv_obj_set_style_border_width(g_btn_prev, 1, LV_PART_MAIN);
  lv_obj_set_style_radius(g_btn_prev, 8, LV_PART_MAIN);
  lv_obj_add_event_cb(g_btn_prev, onPagePrev, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *prev_lbl = lv_label_create(g_btn_prev);
  lv_label_set_text(prev_lbl, LV_SYMBOL_UP);
  lv_obj_set_style_text_color(prev_lbl, kColorAmber, LV_PART_MAIN);
  lv_obj_center(prev_lbl);

  g_page_label = lv_label_create(nav);
  lv_label_set_text(g_page_label, "1 / 1");
  lv_obj_set_style_text_color(g_page_label, kColorMuted, LV_PART_MAIN);

  g_btn_next = lv_btn_create(nav);
  lv_obj_set_size(g_btn_next, 72, 44);
  lv_obj_set_style_bg_color(g_btn_next, kColorBg, LV_PART_MAIN);
  lv_obj_set_style_border_color(g_btn_next, kColorAmber, LV_PART_MAIN);
  lv_obj_set_style_border_width(g_btn_next, 1, LV_PART_MAIN);
  lv_obj_set_style_radius(g_btn_next, 8, LV_PART_MAIN);
  lv_obj_add_event_cb(g_btn_next, onPageNext, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *next_lbl = lv_label_create(g_btn_next);
  lv_label_set_text(next_lbl, LV_SYMBOL_DOWN);
  lv_obj_set_style_text_color(next_lbl, kColorAmber, LV_PART_MAIN);
  lv_obj_center(next_lbl);

  lv_obj_t *map_col = lv_obj_create(row);
  stylePanel(map_col, kColorMap);
  lv_obj_set_width(map_col, mapWidth());
  lv_obj_set_height(map_col, kLcdHeight);
  lv_obj_set_flex_flow(map_col, LV_FLEX_FLOW_COLUMN);
  lv_obj_clear_flag(map_col, LV_OBJ_FLAG_SCROLLABLE);

  g_map = lv_obj_create(map_col);
  stylePanel(g_map, kColorMap);
  lv_obj_set_width(g_map, mapWidth());
  lv_obj_set_height(g_map, mapHeight());
  lv_obj_add_flag(g_map, LV_OBJ_FLAG_OVERFLOW_VISIBLE);
  lv_obj_clear_flag(g_map, LV_OBJ_FLAG_SCROLLABLE);

  g_map_img = lv_img_create(g_map);
  lv_img_set_src(g_map_img, &kWorldMapImg);
  lv_obj_set_pos(g_map_img, 0, 0);
  lv_obj_clear_flag(g_map_img, LV_OBJ_FLAG_CLICKABLE);
  lv_img_set_antialias(g_map_img, true);

  g_pins_layer = lv_obj_create(g_map);
  lv_obj_remove_style_all(g_pins_layer);
  lv_obj_set_size(g_pins_layer, mapWidth(), mapHeight());
  lv_obj_set_pos(g_pins_layer, 0, 0);
  lv_obj_set_style_bg_opa(g_pins_layer, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(g_pins_layer, 0, LV_PART_MAIN);
  lv_obj_clear_flag(g_pins_layer, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(g_pins_layer, LV_OBJ_FLAG_OVERFLOW_VISIBLE);

  lv_obj_t *status = lv_obj_create(map_col);
  stylePanel(status, kColorBg);
  lv_obj_set_width(status, mapWidth());
  lv_obj_set_height(status, kStatusH);
  lv_obj_set_flex_flow(status, LV_FLEX_FLOW_ROW);
  lv_obj_set_style_pad_hor(status, 12, LV_PART_MAIN);
  lv_obj_set_style_pad_ver(status, 6, LV_PART_MAIN);
  lv_obj_set_flex_align(status, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_clear_flag(status, LV_OBJ_FLAG_SCROLLABLE);

  g_wifi_label = lv_label_create(status);
  lv_label_set_text(g_wifi_label, "WiFi: offline");
  lv_obj_set_style_text_color(g_wifi_label, kColorMuted, LV_PART_MAIN);

  g_filter_btn = lv_btn_create(status);
  lv_obj_set_size(g_filter_btn, 118, 28);
  lv_obj_set_style_bg_color(g_filter_btn, kColorBg, LV_PART_MAIN);
  lv_obj_set_style_border_color(g_filter_btn, kColorAmber, LV_PART_MAIN);
  lv_obj_set_style_border_width(g_filter_btn, 1, LV_PART_MAIN);
  lv_obj_set_style_radius(g_filter_btn, 8, LV_PART_MAIN);
  lv_obj_add_event_cb(g_filter_btn, onFilterToggle, LV_EVENT_CLICKED, nullptr);
  g_filter_btn_lbl = lv_label_create(g_filter_btn);
  lv_label_set_text(g_filter_btn_lbl, "To visit");
  lv_obj_set_style_text_color(g_filter_btn_lbl, kColorAmber, LV_PART_MAIN);
  lv_obj_center(g_filter_btn_lbl);

  g_sync_label = lv_label_create(status);
  lv_label_set_text(g_sync_label, "Sync: waiting");
  lv_obj_set_style_text_color(g_sync_label, kColorMuted, LV_PART_MAIN);

  buildDetailOverlay();
  rebuildList();
}

void ui_travelboard_set_wifi(bool connected, const char *ip) {
  if (g_wifi_label == nullptr) {
    return;
  }

  static char s_last[48] = "";
  char buf[48];
  if (connected && ip != nullptr) {
    snprintf(buf, sizeof(buf), "WiFi: %s", ip);
  } else {
    snprintf(buf, sizeof(buf), "WiFi: offline");
  }
  if (strncmp(buf, s_last, sizeof(s_last)) == 0) {
    return;
  }
  strncpy(s_last, buf, sizeof(s_last) - 1);
  s_last[sizeof(s_last) - 1] = '\0';

  lv_label_set_text(g_wifi_label, buf);
  if (connected && ip != nullptr) {
    lv_obj_set_style_text_color(g_wifi_label, kColorEmerald, LV_PART_MAIN);
  } else {
    lv_obj_set_style_text_color(g_wifi_label, kColorMuted, LV_PART_MAIN);
  }
  lv_obj_invalidate(g_wifi_label);
}

void ui_travelboard_set_sync_message(const char *message) {
  if (g_sync_label == nullptr || message == nullptr) {
    return;
  }
  lv_label_set_text(g_sync_label, message);
  lv_obj_invalidate(g_sync_label);
}

void ui_travelboard_apply_data(const TbSyncData *data) {
  if (data == nullptr) {
    return;
  }
  if (dataEqual(data, &g_data)) {
    updateSyncLabel();
    return;
  }

  g_data = *data;
  g_page = 0;
  hideDetail();
  rebuildList();
  rebuildPins();
  updateSyncLabel();
  app_lvgl_invalidate(g_list);
  app_lvgl_invalidate(g_pins_layer);
  app_lvgl_refresh_now();
}

static bool detailVisible() {
  return g_detail_overlay != nullptr && !lv_obj_has_flag(g_detail_overlay, LV_OBJ_FLAG_HIDDEN);
}

// Non-blocking: the cover is served from the on-device flash cache, which the
// background task keeps populated. A miss just means it isn't cached yet, so we
// retry shortly (throttled) until it appears or we time out — the UI never stalls.
void ui_travelboard_loop() {
  if (g_pending_cover_index < 0) {
    return;
  }
  if (!detailVisible()) {  // user closed the card mid-wait
    g_pending_cover_index = -1;
    return;
  }

  const uint32_t now = millis();
  if (now < g_cover_next_try_ms) {
    return;
  }
  g_cover_next_try_ms = now + 300;

  const TbLocation &loc = g_data.locations[g_pending_cover_index];
  uint16_t *pixels = nullptr;
  if (wish_store::load_cover(loc.id, &pixels)) {
    applyCoverPixels(pixels);
    g_pending_cover_index = -1;
    if (g_detail_scroll != nullptr) {
      lv_obj_scroll_to_y(g_detail_scroll, 0, LV_ANIM_OFF);
      app_lvgl_invalidate(g_detail_scroll);
      app_lvgl_refresh_now();
    }
  } else if (now > g_cover_deadline_ms) {
    applyCoverPixels(nullptr);  // not cached in time — show the card without an image
    g_pending_cover_index = -1;
    app_lvgl_refresh_now();
  }
  // else: still being downloaded by the background task — try again shortly
}
