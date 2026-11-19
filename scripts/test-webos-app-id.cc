#include "webos_app_id.h"

#include <unistd.h>

#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <string>

int main() {
  using namespace starboard::shared::webos;

  // Sanitization rejects empty, traversal, injection, and dot-only inputs.
  assert(SanitizeWebosAppId(nullptr) == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId(".") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("..") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId(".leading") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("trailing.") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("a..b") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("foo/bar") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("foo\"bar") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("___") == kDefaultWebosAppId);
  assert(SanitizeWebosAppId("youtube.leanback.v4.arabic") ==
         "youtube.leanback.v4.arabic");
  assert(SanitizeWebosAppId("custom.app_1-test") == "custom.app_1-test");

  // Log paths stay strictly within /tmp.
  assert(WebosStarterlessLogPath("youtube.leanback.v4.arabic") ==
         "/tmp/cobalt-starterless-youtube.leanback.v4.arabic.log");
  assert(WebosStarterlessLogPath("../../etc/passwd") ==
         "/tmp/cobalt-starterless-youtube.leanback.v4.arabic.log");

  // EnsureDirectoryTree must reject regular files even though mkdir fails with EEXIST.
  char tmpl[] = "/tmp/webos-appid-test-XXXXXX";
  char* tmp_dir = mkdtemp(tmpl);
  assert(tmp_dir != nullptr);
  const std::string regular_file = std::string(tmp_dir) + "/not-a-dir";
  FILE* fp = std::fopen(regular_file.c_str(), "w");
  assert(fp != nullptr);
  std::fclose(fp);
  assert(!EnsureDirectoryTree(regular_file));
  assert(!EnsureDirectoryTree(regular_file + "/child"));

  // Unwritable/file-blocked HOME falls back to /tmp/.cobalt-apps/<id>.
  unsetenv("XDG_CACHE_HOME");
  unsetenv("XDG_CONFIG_HOME");
  unsetenv("XDG_DATA_HOME");
  setenv("HOME", regular_file.c_str(), 1);
  IsolateWebosStorageEnvironment("youtube.leanback.v4.arabic");
  assert(std::string(std::getenv("HOME")) ==
         "/tmp/.cobalt-apps/youtube.leanback.v4.arabic");
  assert(std::string(std::getenv("XDG_CACHE_HOME")) ==
         "/tmp/.cobalt-apps/youtube.leanback.v4.arabic/cache");

  // Prefix-similar existing HOME must still isolate a shorter app ID.
  const std::string existing_scoped =
      std::string(tmp_dir) + "/.cobalt-apps/youtube.leanback.v4.arabic";
  assert(EnsureDirectoryTree(existing_scoped));
  setenv("HOME", existing_scoped.c_str(), 1);
  setenv("XDG_CACHE_HOME", "/tmp/shared-cache", 1);
  IsolateWebosStorageEnvironment("youtube.leanback.v4");
  const std::string expected_home =
      existing_scoped + "/.cobalt-apps/youtube.leanback.v4";
  assert(std::string(std::getenv("HOME")) == expected_home);
  assert(std::string(std::getenv("XDG_CACHE_HOME")) ==
         expected_home + "/cache");

  // Calling again with the already-isolated HOME is idempotent.
  IsolateWebosStorageEnvironment("youtube.leanback.v4");
  assert(std::string(std::getenv("HOME")) == expected_home);

  // Trailing slash in HOME must still isolate cleanly without double slashes.
  std::string trailing_base = std::string(tmp_dir) + "/trailing/";
  assert(EnsureDirectoryTree(trailing_base));
  setenv("HOME", trailing_base.c_str(), 1);
  IsolateWebosStorageEnvironment("youtube.leanback.v4.arabic");
  assert(std::string(std::getenv("HOME")) ==
         std::string(tmp_dir) +
             "/trailing/.cobalt-apps/youtube.leanback.v4.arabic");

  std::puts("webos_app_id C++14 tests passed");
  return 0;
}
