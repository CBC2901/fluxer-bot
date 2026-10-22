const assert = require('node:assert/strict');
const test = require('node:test');
const { locales, translate } = require('../src/locales');

test('all supported locales contain core command help and format placeholders', () => {
  for (const language of ['tr', 'az', 'en', 'es']) {
    assert.ok(locales[language].help.includes('{prefix}'));
    assert.equal(translate(language, 'balance', { user: 'Player', balance: 12, xp: 3 }).includes('12'), true);
    assert.equal(translate(language, 'languageSet').length > 0, true);
  }
});

test('all four locales provide the same translation keys', () => {
  const flattenKeys = (value, parent = '') => Object.entries(value).flatMap(([key, child]) => {
    const path = parent ? `${parent}.${key}` : key;
    return typeof child === 'string' ? [path] : flattenKeys(child, path);
  }).sort();
  const expected = flattenKeys(locales.tr);
  for (const language of ['az', 'en', 'es']) {
    assert.deepEqual(flattenKeys(locales[language]), expected, `${language} locale is incomplete or has extra keys`);
  }
});
