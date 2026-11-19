import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import en from '../src/languages/en.js';

const arUrl = new URL('../src/languages/ar.js', import.meta.url);
const indexUrl = new URL('../src/languages/index.js', import.meta.url);
const uiUrl = new URL('../src/ui.js', import.meta.url);
const uiCssUrl = new URL('../src/ui.css', import.meta.url);
const checkboxCssUrl = new URL('../src/checkboxTools.css', import.meta.url);
const choiceCssUrl = new URL('../src/choiceTools.css', import.meta.url);
const qrUiUrl = new URL('../src/sponsored-qr-code-ui.js', import.meta.url);
const rydUrl = new URL('../src/returnyoutubedislike.js', import.meta.url);

test('ar.js defines every UI and SponsorBlock key in pure Arabic without English letters', async () => {
  assert.equal(existsSync(arUrl), true, 'Expected webapp/src/languages/ar.js to exist');
  const { default: ar } = await import(arUrl.href);

  const requiredUiKeys = [
    ...new Set([
      ...Object.keys(en.ui),
      'sponsoredQrCodeBlock',
      'playbackSpeed',
      'dislikeLabel'
    ])
  ];

  for (const key of requiredUiKeys) {
    const value = ar.ui?.[key];
    assert.equal(typeof value, 'string', `Missing ar.ui.${key}`);
    assert.ok(value.trim().length > 0, `Empty ar.ui.${key}`);
    const stripped = value.replace(/\{rate\}/g, '');
    assert.equal(
      /[A-Za-z]/.test(stripped),
      false,
      `Expected no English letters in ar.ui.${key}, got: ${value}`
    );
    assert.match(value, /[\u0600-\u06FF]/, `Expected Arabic characters in ar.ui.${key}`);
  }

  for (const key of Object.keys(en.sponsorBlock)) {
    const value = ar.sponsorBlock?.[key];
    assert.equal(typeof value, 'string', `Missing ar.sponsorBlock.${key}`);
    assert.ok(value.trim().length > 0, `Empty ar.sponsorBlock.${key}`);
    assert.equal(
      /[A-Za-z]/.test(value),
      false,
      `Expected no English letters in ar.sponsorBlock.${key}, got: ${value}`
    );
    assert.match(value, /[\u0600-\u06FF]/, `Expected Arabic characters in ar.sponsorBlock.${key}`);
  }
});

test('languages/index.js always activates Arabic and detects RTL correctly', async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'en-US', languages: ['en-US', 'en'] }
  });

  try {
    const mod = await import(`${indexUrl.href}?t=${Date.now()}`);
    assert.equal(mod.getLanguage(), 'ar');
    assert.equal(typeof mod.isRtlLanguage, 'function');
    assert.equal(mod.isRtlLanguage(), true);
    assert.equal(mod.isRtlLanguage('ar-SA'), true);
    assert.equal(mod.isRtlLanguage('en'), false);
    assert.match(mod.text('ui', 'openHint'), /[\u0600-\u06FF]/);
    assert.equal(/[A-Za-z]/.test(mod.text('ui', 'openHint')), false);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
      delete globalThis.navigator;
    }
  }
});

test('ui.js applies RTL direction, right-side placement, and localized playback speed notification', () => {
  const uiSource = readFileSync(uiUrl, 'utf8');
  assert.match(uiSource, /isRtlLanguage/);
  assert.match(uiSource, /ytaf-rtl/);
  assert.match(uiSource, /dir['"]?\s*,\s*['"]rtl['"]/);
  assert.equal(/Playback speed:/.test(uiSource), false, 'Hardcoded English playback speed string must be removed');
  assert.match(uiSource, /text\(['"]playbackSpeed['"]\)/);
  assert.match(uiSource, /right:\s*rtl\s*\?\s*['"]64px['"]\s*:\s*['"]auto['"]/);
  assert.match(uiSource, /left:\s*rtl\s*\?\s*['"]auto['"]\s*:\s*['"]64px['"]/);
});

test('sponsored-qr-code-ui.js and returnyoutubedislike.js use localized Arabic labels', () => {
  const qrSource = readFileSync(qrUiUrl, 'utf8');
  assert.match(qrSource, /languageText|text\(/);
  assert.match(qrSource, /sponsoredQrCodeBlock/);

  const rydSource = readFileSync(rydUrl, 'utf8');
  assert.equal(
    /['"]Dislikes['"]/.test(rydSource),
    false,
    'Hardcoded English Dislikes label must be replaced with localized text'
  );
  assert.match(rydSource, /dislikeLabel/);
});

test('CSS files define Cobalt-compatible RTL rules with Chrome 38-79 margin fallbacks', () => {
  const uiCss = readFileSync(uiCssUrl, 'utf8');
  const checkboxCss = readFileSync(checkboxCssUrl, 'utf8');
  const choiceCss = readFileSync(choiceCssUrl, 'utf8');
  const allCss = `${uiCss}\n${checkboxCss}\n${choiceCss}`;

  assert.match(uiCss, /\.ytaf-ui-container\.ytaf-rtl/);
  assert.match(uiCss, /\.ytaf-notification-container\.ytaf-rtl/);
  assert.match(uiCss, /border-right:\s*2px solid/);
  assert.match(uiCss, /border-right-color:/);
  assert.match(checkboxCss, /\.ytaf-rtl\s+\.toggler-wrapper\.ytaf-focused/);
  assert.match(checkboxCss, /\.ytaf-rtl\s+\.toggler-wrapper\s+\.desc[\s\S]*margin-right:\s*12px/);
  assert.match(choiceCss, /\.ytaf-rtl\s+\.choice-wrapper\.ytaf-focused/);
  assert.match(choiceCss, /\.ytaf-rtl\s+\.choice-wrapper\s+\.choice-value[\s\S]*margin-right:\s*12px/);

  assert.equal(
    /inline-start|inline-end|var\(--/.test(allCss),
    false,
    'Avoid CSS logical properties and CSS variables for older Cobalt compatibility'
  );
});
