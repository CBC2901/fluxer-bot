const locales = {
  tr: require('./tr'),
  az: require('./az'),
  en: require('./en'),
  es: require('./es'),
};

function translate(language, key, values = {}) {
  const parts = key.split('.');
  let value = locales[language] || locales.tr;
  for (const part of parts) value = value?.[part];
  if (typeof value !== 'string') throw new Error(`Missing translation: ${language}.${key}`);
  return value.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

module.exports = { locales, translate };
