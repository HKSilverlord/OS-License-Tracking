import { useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * The BCP-47 tag behind a UI language, which is what `Intl` wants.
 *
 * Exported because a few module-level formatters need it without a hook.
 */
export const localeTagFor = (language: string): string =>
  language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';

export interface NumberFormat {
  /** e.g. `vi-VN`. */
  localeTag: string;
  /** 9600 reads `9.600` in Vietnamese and `9,600` in English and Japanese. */
  format: (value: number) => string;
  /** One decimal place, with the language's own decimal mark. */
  formatDecimal: (value: number) => string;
}

/**
 * Numbers in the language the UI is in.
 *
 * A bare `toLocaleString()` follows the BROWSER's locale, not the app's, so a
 * Vietnamese manager on an English-locale machine got `9,600` in one view and
 * `9.600` in another - and two screenshots pasted side by side into one report
 * disagreed about what a thousands separator looks like.
 */
export function useNumberFormat(): NumberFormat {
  const { language } = useLanguage();
  const localeTag = localeTagFor(language);

  const whole = useMemo(() => new Intl.NumberFormat(localeTag), [localeTag]);
  const decimal = useMemo(
    () => new Intl.NumberFormat(localeTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [localeTag]
  );

  return {
    localeTag,
    format: useCallback((value: number) => whole.format(value), [whole]),
    formatDecimal: useCallback((value: number) => decimal.format(value), [decimal]),
  };
}
