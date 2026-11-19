#ifndef STARBOARD_WEBOS_ARM_WEBOS_APP_ID_H_
#define STARBOARD_WEBOS_ARM_WEBOS_APP_ID_H_

#include <sys/stat.h>

#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <string>

namespace starboard {
namespace shared {
namespace webos {

constexpr const char* kDefaultWebosAppId = "youtube.leanback.v4.arabic";

inline bool IsWebosAppIdAlnum(unsigned char ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
         (ch >= '0' && ch <= '9');
}

inline bool IsValidWebosAppIdChar(unsigned char ch) {
  return IsWebosAppIdAlnum(ch) || ch == '.' || ch == '_' || ch == '-';
}

inline std::string SanitizeWebosAppId(const char* raw_app_id) {
  if (!raw_app_id || !*raw_app_id) {
    return kDefaultWebosAppId;
  }

  const size_t length = std::strlen(raw_app_id);
  if (length == 0 || length > 128) {
    return kDefaultWebosAppId;
  }
  if (raw_app_id[0] == '.' || raw_app_id[length - 1] == '.') {
    return kDefaultWebosAppId;
  }

  bool has_alnum = false;
  for (size_t i = 0; i < length; ++i) {
    const unsigned char ch = static_cast<unsigned char>(raw_app_id[i]);
    if (!IsValidWebosAppIdChar(ch)) {
      return kDefaultWebosAppId;
    }
    if (ch == '.' && i + 1 < length && raw_app_id[i + 1] == '.') {
      return kDefaultWebosAppId;
    }
    if (IsWebosAppIdAlnum(ch)) {
      has_alnum = true;
    }
  }

  if (!has_alnum) {
    return kDefaultWebosAppId;
  }

  return std::string(raw_app_id, length);
}

inline const std::string& WebosAppId() {
  static const std::string* cached =
      new std::string(SanitizeWebosAppId(std::getenv("APPID")));
  return *cached;
}

inline std::string WebosStarterlessLogPath(const std::string& app_id) {
  return "/tmp/cobalt-starterless-" + SanitizeWebosAppId(app_id.c_str()) +
         ".log";
}

inline bool IsExistingDirectory(const std::string& path) {
  struct stat st;
  return stat(path.c_str(), &st) == 0 && S_ISDIR(st.st_mode);
}

inline bool EnsureDirectoryTree(const std::string& path) {
  if (path.empty()) return false;
  std::string current;
  current.reserve(path.size());
  for (size_t i = 0; i < path.size(); ++i) {
    current.push_back(path[i]);
    if (path[i] == '/' && i > 0) {
      if (!IsExistingDirectory(current) &&
          !(mkdir(current.c_str(), 0700) == 0 ||
            (errno == EEXIST && IsExistingDirectory(current)))) {
        return false;
      }
    }
  }
  return IsExistingDirectory(current) || mkdir(current.c_str(), 0700) == 0 ||
         (errno == EEXIST && IsExistingDirectory(current));
}

inline bool EndsWithPath(const std::string& value, const std::string& suffix) {
  return value.size() >= suffix.size() &&
         value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

inline bool HasScopedAppIdPath(const std::string& path,
                               const std::string& safe_id) {
  const std::string scoped_suffix = "/.cobalt-apps/" + safe_id;
  const std::string scoped_segment = "/" + safe_id + "/";
  return EndsWithPath(path, scoped_suffix) ||
         EndsWithPath(path, "/" + safe_id) ||
         path.find(scoped_segment) != std::string::npos;
}

inline void IsolateWebosStorageEnvironment(const std::string& app_id) {
  const std::string safe_id = SanitizeWebosAppId(app_id.c_str());
  const char* raw_home = std::getenv("HOME");
  std::string base_home =
      (raw_home && *raw_home) ? std::string(raw_home) : std::string("/tmp");
  while (base_home.size() > 1 && base_home.back() == '/') {
    base_home.pop_back();
  }

  const std::string scoped_suffix = "/.cobalt-apps/" + safe_id;
  std::string app_root;
  if (HasScopedAppIdPath(base_home, safe_id)) {
    app_root = base_home;
  } else {
    const std::string home_prefix = (base_home == "/") ? std::string() : base_home;
    app_root = home_prefix + scoped_suffix;
    if (!EnsureDirectoryTree(app_root)) {
      app_root = "/tmp" + scoped_suffix;
      if (!EnsureDirectoryTree(app_root)) {
        return;
      }
    }
    setenv("HOME", app_root.c_str(), 1);
  }

  const struct {
    const char* env_name;
    const char* subdir;
  } xdg_vars[] = {
      {"XDG_CACHE_HOME", "/cache"},
      {"XDG_CONFIG_HOME", "/config"},
      {"XDG_DATA_HOME", "/data"},
  };
  for (const auto& entry : xdg_vars) {
    const char* current = std::getenv(entry.env_name);
    if (current && *current && HasScopedAppIdPath(current, safe_id)) {
      continue;
    }
    const std::string target = app_root + entry.subdir;
    if (EnsureDirectoryTree(target)) {
      setenv(entry.env_name, target.c_str(), 1);
    }
  }
}

}  // namespace webos
}  // namespace shared
}  // namespace starboard

#endif  // STARBOARD_WEBOS_ARM_WEBOS_APP_ID_H_
