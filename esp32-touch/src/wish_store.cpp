#include "wish_store.h"

#include <Arduino.h>
#include <LittleFS.h>
#include <esp_heap_caps.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#include "cover_image.h"

namespace {

static SemaphoreHandle_t s_fs_mutex = nullptr;
static bool s_mounted = false;

static constexpr uint32_t kWishMagic = 0x54425721;  // 'TBW!'
static constexpr uint16_t kWishVersion = 1;
static constexpr char kWishPath[] = "/wishes.bin";

struct WishHeader {
  uint32_t magic;
  uint16_t version;
  uint16_t reserved;
  uint32_t struct_size;  // sizeof(TbSyncData) sanity check
};

// RAII lock; LittleFS (esp_littlefs) is not safe for concurrent ops on a mount.
// UI-thread reads pass a short timeout so they never stall behind the net task's
// (slow) cover writes — a contended read just fails and the UI retries next poll.
struct FsLock {
  bool ok = false;
  explicit FsLock(uint32_t timeout_ms = 3000) {
    if (s_fs_mutex != nullptr) {
      ok = xSemaphoreTake(s_fs_mutex, pdMS_TO_TICKS(timeout_ms)) == pdTRUE;
    }
  }
  ~FsLock() {
    if (ok) {
      xSemaphoreGive(s_fs_mutex);
    }
  }
};

// Short timeout for UI-thread reads (load_cover/has_cover) so the UI never blocks.
static constexpr uint32_t kReadLockMs = 80;

uint32_t fnv1a(const char *s) {
  uint32_t h = 2166136261u;
  while (*s) {
    h ^= static_cast<uint8_t>(*s++);
    h *= 16777619u;
  }
  return h;
}

// LittleFS name length is limited; hash the id to a fixed short filename.
void cover_path(const char *id, char *out, size_t cap) {
  snprintf(out, cap, "/cv_%08lx.565", static_cast<unsigned long>(fnv1a(id)));
}

}  // namespace

namespace wish_store {

bool begin() {
  if (s_mounted) {
    return true;
  }
  if (s_fs_mutex == nullptr) {
    s_fs_mutex = xSemaphoreCreateMutex();
  }
  if (!LittleFS.begin(true)) {  // format on first run
    Serial.println("[store] LittleFS mount failed");
    return false;
  }
  s_mounted = true;
  Serial.printf("[store] LittleFS mounted (%u/%u KB used)\n",
                static_cast<unsigned>(LittleFS.usedBytes() / 1024),
                static_cast<unsigned>(LittleFS.totalBytes() / 1024));
  return true;
}

bool load_wishes(TbSyncData *out) {
  if (out == nullptr || !s_mounted) {
    return false;
  }
  FsLock lock(300);  // UI thread (on data_dirty) — don't stall behind cover writes
  if (!lock.ok) {
    return false;  // contended; caller keeps the dirty flag and retries
  }
  File f = LittleFS.open(kWishPath, "r");
  if (!f) {
    return false;
  }
  WishHeader h = {};
  bool ok = f.read(reinterpret_cast<uint8_t *>(&h), sizeof(h)) == sizeof(h) &&
            h.magic == kWishMagic && h.version == kWishVersion &&
            h.struct_size == sizeof(TbSyncData);
  if (ok) {
    ok = f.read(reinterpret_cast<uint8_t *>(out), sizeof(TbSyncData)) == sizeof(TbSyncData);
  }
  f.close();
  if (!ok || out->count < 0 || out->count > kTbMaxLocations) {
    return false;
  }
  return true;
}

bool save_wishes(const TbSyncData *data) {
  if (data == nullptr || !s_mounted) {
    return false;
  }
  FsLock lock;
  if (!lock.ok) {
    return false;
  }
  File f = LittleFS.open(kWishPath, "w");
  if (!f) {
    return false;
  }
  const WishHeader h = {kWishMagic, kWishVersion, 0, static_cast<uint32_t>(sizeof(TbSyncData))};
  bool ok = f.write(reinterpret_cast<const uint8_t *>(&h), sizeof(h)) == sizeof(h);
  ok = ok && f.write(reinterpret_cast<const uint8_t *>(data), sizeof(TbSyncData)) ==
                 sizeof(TbSyncData);
  f.close();
  return ok;
}

bool has_cover(const char *id) {
  if (id == nullptr || id[0] == '\0' || !s_mounted) {
    return false;
  }
  FsLock lock(kReadLockMs);
  if (!lock.ok) {
    return false;
  }
  char path[24];
  cover_path(id, path, sizeof(path));
  return LittleFS.exists(path);
}

bool load_cover(const char *id, uint16_t **out_pixels) {
  if (id == nullptr || id[0] == '\0' || out_pixels == nullptr || !s_mounted) {
    return false;
  }
  FsLock lock(kReadLockMs);
  if (!lock.ok) {
    return false;
  }
  char path[24];
  cover_path(id, path, sizeof(path));
  File f = LittleFS.open(path, "r");
  if (!f) {
    return false;
  }
  const size_t want = static_cast<size_t>(kCoverImgW) * kCoverImgH * sizeof(uint16_t);
  if (f.size() != want) {
    f.close();
    return false;
  }
  uint16_t *buf =
      static_cast<uint16_t *>(heap_caps_malloc(want, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (buf == nullptr) {
    f.close();
    return false;
  }
  const size_t got = f.read(reinterpret_cast<uint8_t *>(buf), want);
  f.close();
  if (got != want) {
    heap_caps_free(buf);
    return false;
  }
  *out_pixels = buf;
  return true;
}

bool save_cover(const char *id, const uint16_t *pixels, size_t bytes) {
  if (id == nullptr || id[0] == '\0' || pixels == nullptr || bytes == 0 || !s_mounted) {
    return false;
  }
  FsLock lock;
  if (!lock.ok) {
    return false;
  }
  char path[24];
  cover_path(id, path, sizeof(path));
  File f = LittleFS.open(path, "w");
  if (!f) {
    return false;
  }
  const bool ok = f.write(reinterpret_cast<const uint8_t *>(pixels), bytes) == bytes;
  f.close();
  return ok;
}

}  // namespace wish_store
