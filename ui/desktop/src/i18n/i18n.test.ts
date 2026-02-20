import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from './en.json';
import ru from './ru.json';
import { currentLocale, currentLocaleTag, t } from './index';

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === 'object') {
      return flattenKeys(nested as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe('i18n dictionaries', () => {
  it('keeps en.json and ru.json in key parity', () => {
    const enKeys = flattenKeys(en as Record<string, unknown>).sort();
    const ruKeys = flattenKeys(ru as Record<string, unknown>).sort();

    expect(ruKeys).toEqual(enKeys);
  });
});

describe('i18n core', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      appConfig: {
        get: () => undefined,
      },
    });
  });

  it('reads locale from config when locale is supported', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'ru' : undefined),
      },
    });

    expect(currentLocale()).toBe('ru');
  });

  it('falls back to default locale when configured locale is not supported', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'fr' : undefined),
      },
    });

    expect(currentLocale()).toBe('en');
  });

  it('returns localized value when key exists', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'ru' : undefined),
      },
    });

    expect(t('common.loading', 'Loading...')).toBe('Загрузка...');
  });

  it('uses configured locale tag for date/time formatting', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'ru_RU' : undefined),
      },
    });

    expect(currentLocaleTag()).toBe('ru-RU');
  });

  it('normalizes POSIX-style locale tags for date/time formatting', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'en_US.UTF-8' : undefined),
      },
    });

    expect(currentLocaleTag()).toBe('en-US');
  });

  it('falls back to en-US when configured locale tag is invalid', () => {
    vi.stubGlobal('window', {
      appConfig: {
        get: (key: string) => (key === 'GOOSE_LOCALE' ? 'invalid#locale' : undefined),
      },
    });

    expect(currentLocaleTag()).toBe('en-US');
  });

  it('returns fallback for missing translation key', () => {
    expect(t('missing.path', 'Fallback value')).toBe('Fallback value');
  });

  it('keeps variable interpolation in fallback path', () => {
    expect(t('missing.path', 'Hello {name}', { name: 'Goose' })).toBe('Hello Goose');
  });
});
