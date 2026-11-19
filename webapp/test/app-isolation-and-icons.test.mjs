import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const rootUrl = new URL('../../', import.meta.url);
const appinfoUrl = new URL('starterless-cobalt/appinfo.json', rootUrl);
const configUrl = new URL('webapp/src/config.js', rootUrl);
const buildGnUrl = new URL('cobalt-platform/webos/arm/BUILD.gn', rootUrl);
const webosAppIdUrl = new URL('cobalt-platform/webos/arm/webos_app_id.h', rootUrl);
const appSdlUrl = new URL('cobalt-platform/webos/arm/application_sdl.cc', rootUrl);
const avCompUrl = new URL('cobalt-platform/webos/arm/starfish_av_components.cc', rootUrl);
const decoderUrl = new URL('cobalt-platform/webos/arm/starfish_video_decoder.cc', rootUrl);
const mainUrl = new URL('cobalt-platform/webos/arm/main.cc', rootUrl);

function readPngInfo(fileUrl) {
  const buf = readFileSync(fileUrl);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Valid PNG signature');
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25]
  };
}

test('appinfo.json uses an isolated Arabic app ID, title, DIAL name, splashBackground, and matching dark iconColor', () => {
  const appinfo = JSON.parse(readFileSync(appinfoUrl, 'utf8'));
  assert.equal(appinfo.id, 'youtube.leanback.v4.arabic');
  assert.equal(appinfo.title, 'يوتيوب بدون إعلانات');
  assert.notEqual(appinfo.dialAppName, 'YouTube');
  assert.equal(appinfo.iconColor, '#0f0f0f');
  assert.equal(appinfo.splashBackground, 'splashBackground.png');

  const pkgScript = readFileSync(
    new URL('scripts/package-starterless-cobalt.sh', rootUrl),
    'utf8'
  );
  assert.match(pkgScript, /assets\/splashBackground\.png/);
});

test('webapp config.js isolates localStorage reads and writes under the Arabic key', () => {
  const configSource = readFileSync(configUrl, 'utf8')
    .replace(/export\s+function\s+/g, 'function ');
  const storage = {};
  const dispatched = [];
  const context = vm.createContext({
    window: {
      localStorage: storage,
      dispatchEvent(evt) {
        dispatched.push({ target: 'window', evt });
      }
    },
    document: {
      dispatchEvent(evt) {
        dispatched.push({ target: 'document', evt });
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    console: { info() {}, warn() {}, error() {} }
  });

  vm.runInContext(`${configSource}; globalThis.configRead = configRead; globalThis.configWrite = configWrite;`, context);
  assert.equal(context.configRead('enableAdBlock'), true);
  context.configWrite('enableAdBlock', false);
  assert.equal(context.configRead('enableAdBlock'), false);
  assert.ok(storage['ytaf-configuration-cobalt-adfree-arabic-v2']);
  assert.equal(storage['ytaf-configuration-cobalt-adfree-v2'], undefined);
  assert.equal(dispatched.length, 2);
});

test('native C++ files share sanitized WebosAppId(), isolate storage/logs, and register webos_app_id.h', () => {
  const buildGn = readFileSync(buildGnUrl, 'utf8');
  assert.match(buildGn, /"webos_app_id\.h"/);

  const header = readFileSync(webosAppIdUrl, 'utf8');
  assert.equal(/\binline\s+constexpr\b/.test(header), false, 'webos_app_id.h must stay C++14 compatible');
  assert.match(header, /SanitizeWebosAppId/);
  assert.match(header, /WebosAppId/);
  assert.match(header, /WebosStarterlessLogPath/);
  assert.match(header, /IsolateWebosStorageEnvironment/);
  assert.match(header, /youtube\.leanback\.v4\.arabic/);

  for (const url of [appSdlUrl, avCompUrl, decoderUrl, mainUrl]) {
    const src = readFileSync(url, 'utf8');
    assert.match(src, /#include "starboard\/webos\/arm\/webos_app_id\.h"/);
    assert.match(src, /WebosAppId\(\)/);
    assert.equal(
      src.includes('youtube.leanback.v4"'),
      false,
      `${url.pathname} must not contain old youtube.leanback.v4 fallback`
    );
  }

  const mainCpp = readFileSync(mainUrl, 'utf8');
  assert.match(mainCpp, /IsolateWebosStorageEnvironment\(app_id\)/);
  assert.match(mainCpp, /WebosStarterlessLogPath\(app_id\)/);
});

test('dark-mode app icons and splash assets preserve required webOS dimensions and RGB format', () => {
  const expected = {
    'assets/icon.png': [80, 80],
    'assets/mediumLargeIcon.png': [115, 115],
    'assets/largeIcon.png': [130, 130],
    'assets/extraLargeIcon.png': [192, 192],
    'assets/playIcon.png': [33, 23],
    'assets/splashBackground.png': [1920, 1080],
    'assets/bgImage.png': [1920, 1080],
    'assets/imageForRecents.png': [1920, 1080]
  };

  for (const [relPath, [w, h]] of Object.entries(expected)) {
    const info = readPngInfo(new URL(relPath, rootUrl));
    assert.equal(info.width, w, `${relPath} width`);
    assert.equal(info.height, h, `${relPath} height`);
    assert.ok(info.colorType === 2 || info.colorType === 6, `${relPath} RGB/RGBA colorType`);
  }
});
