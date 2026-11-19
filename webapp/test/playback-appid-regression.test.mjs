import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

const rootUrl = new URL('../../', import.meta.url);
const pkgScriptUrl = new URL('scripts/package-starterless-cobalt.sh', rootUrl);
const appinfoUrl = new URL('starterless-cobalt/appinfo.json', rootUrl);
const avCompUrl = new URL('cobalt-platform/webos/arm/starfish_av_components.cc', rootUrl);
const decoderUrl = new URL('cobalt-platform/webos/arm/starfish_video_decoder.cc', rootUrl);
const appSdlUrl = new URL('cobalt-platform/webos/arm/application_sdl.cc', rootUrl);

test('package-starterless-cobalt.sh rejects stale Cobalt binaries hardcoding youtube.leanback.v4 appId', () => {
  const script = readFileSync(pkgScriptUrl, 'utf8');
  assert.match(
    script,
    /appId.*youtube\.leanback\.v4/,
    'Packaging script must guard against stale binaries hardcoding "appId":"youtube.leanback.v4"'
  );
  assert.match(
    script,
    /\$package_id.*!=.*youtube\.leanback\.v4|youtube\.leanback\.v4.*!=.*\$package_id/,
    'Packaging guard must trigger whenever package_id differs from youtube.leanback.v4'
  );
});

test('all native Starfish and Acb payloads share WebosAppId() without hardcoded youtube.leanback.v4', () => {
  const avComp = readFileSync(avCompUrl, 'utf8');
  const decoder = readFileSync(decoderUrl, 'utf8');
  const appSdl = readFileSync(appSdlUrl, 'utf8');

  assert.equal(avComp.includes('"appId":"youtube.leanback.v4"'), false);
  assert.equal(avComp.includes('\\"appId\\":\\"youtube.leanback.v4\\"'), false);
  assert.match(avComp, /\\"appId\\":\\"%s\\"/);
  assert.match(avComp, /::starboard::shared::webos::WebosAppId\(\)/);
  assert.match(decoder, /\\"appId\\":\\"%s\\"/);
  assert.match(decoder, /::starboard::shared::webos::WebosAppId\(\)/);
  assert.match(appSdl, /::starboard::shared::webos::WebosAppId\(\)/);
});

function extractArMember(arBytes, targetName) {
  let offset = 8; // skip "!<arch>\n"
  while (offset + 60 <= arBytes.length) {
    const name = arBytes.subarray(offset, offset + 16).toString('ascii').trim();
    const size = Number(arBytes.subarray(offset + 48, offset + 58).toString('ascii').trim());
    const start = offset + 60;
    const end = start + size;
    if (name === targetName) return arBytes.subarray(start, end);
    offset = end + (size % 2);
  }
  return null;
}

test('local IPK must not contain unrebuilt Cobalt binary with hardcoded youtube.leanback.v4 appId', () => {
  const appinfo = JSON.parse(readFileSync(appinfoUrl, 'utf8'));
  const localIpkUrl = new URL(`output/${appinfo.id}_${appinfo.version}_arm.ipk`, rootUrl);
  if (appinfo.id !== 'youtube.leanback.v4' && existsSync(localIpkUrl)) {
    const dataGz = extractArMember(readFileSync(localIpkUrl), 'data.tar.gz');
    assert.ok(dataGz, 'Expected data.tar.gz inside IPK');
    const dataTar = gunzipSync(dataGz);
    assert.equal(
      dataTar.includes(Buffer.from('"appId":"youtube.leanback.v4"')),
      false,
      'Local IPK contains unrebuilt Cobalt binary with hardcoded youtube.leanback.v4 appId (causes black screen)'
    );
  }
});
