import en from './en.json';
import ru from './ru.json';

type Dictionary = Record<string, string>;
type Locale = 'en' | 'ru';

const dictionaries: Record<Locale, Dictionary> = {
  en,
  ru,
};

let runtimeLocale: Locale | null = null;

const normalizeLocale = (locale: unknown): Locale => {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

const localeFromRendererConfig = (): Locale => {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const configuredLocale = window.appConfig?.get('GOOSE_LOCALE');
  return normalizeLocale(configuredLocale);
};

export const setRuntimeLocale = (locale: unknown): void => {
  runtimeLocale = normalizeLocale(locale);
};

export const getRuntimeLocale = (): Locale => {
  if (runtimeLocale) {
    return runtimeLocale;
  }

  return localeFromRendererConfig();
};

export const t = (key: string, fallback?: string): string => {
  const locale = getRuntimeLocale();
  const localized = dictionaries[locale][key];
  if (localized) {
    return localized;
  }

  const english = dictionaries.en[key];
  if (english) {
    return english;
  }

  return fallback ?? key;
};
