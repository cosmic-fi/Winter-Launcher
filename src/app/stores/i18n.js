// i18n.js
import { writable, derived } from 'svelte/store';
import en from '../../../locale/en.json';

// TODO: Add more languages later
// import fr from '../../../locale/fr.json';
// import tr from '../../../locale/tr.json';
// import es from '../../../locale/es.json';

const locales = { en };

export const currentLocale = writable('en');

export const translations = derived(currentLocale, $locale => {
  return locales[$locale] || locales.en;
});

// ✅ t function with interpolation support
// Usage: $t('key', { variableName: value })
// In translation JSON: "key": "Value: {variableName}"
export const t = derived(translations, $translations => {
  return (key, params = {}) => {
    const translation = key.split('.').reduce((obj, part) => obj?.[part], $translations) || key;
    
    // Interpolate variables: {variableName} -> params.variableName
    return translation.replace(/\{([^}]+)\}/g, (match, key) => {
      // Support nested properties like {compatibleInstances.length}
      const value = key.split('.').reduce((obj, prop) => obj?.[prop], params);
      return value !== undefined && value !== null ? String(value) : match;
    });
  };
});