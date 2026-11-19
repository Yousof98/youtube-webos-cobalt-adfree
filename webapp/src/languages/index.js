import ar from './ar.js';

const languages = { ar };
const forcedLanguage = 'ar';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

export function getLanguage() {
  return forcedLanguage;
}

export function isRtlLanguage(language = getLanguage()) {
  const base = String(language || '').toLowerCase().split('-')[0];
  return RTL_LANGUAGES.has(base);
}

export function text(section, key) {
  const language = getLanguage();
  const selected = languages[language] || languages[forcedLanguage];

  return selected[section]?.[key] || key;
}
