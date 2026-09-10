import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../locales';

export type SupportedLanguage = 'ja' | 'en' | 'vn';

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LANGUAGE_STORAGE_KEY = 'app_language';

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: SupportedLanguage; label: string; short: string }> = [
  { code: 'ja', label: '日本語', short: 'JA' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'vn', label: 'Tiếng Việt', short: 'VN' },
];

const LANGUAGE_ORDER: SupportedLanguage[] = ['ja', 'en', 'vn'];

const isSupportedLanguage = (value: string | null): value is SupportedLanguage =>
  value !== null && (LANGUAGE_ORDER as readonly string[]).includes(value);

const readStoredLanguage = (): SupportedLanguage => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage can throw (private mode, blocked storage) — fall back to the default.
  }
  return 'ja';
};

/**
 * Module-level mirror of the active language, kept in sync by `LanguageProvider`.
 *
 * `translate()` exists for code that runs outside React and therefore cannot call
 * the `useLanguage()` hook — `utils/chartExport.ts` raises toasts from plain
 * functions. Components must keep using `useLanguage().t`, which re-renders on a
 * language change; `translate()` does not subscribe to anything.
 */
let activeLanguage: SupportedLanguage = readStoredLanguage();

export function translate(key: string, fallback?: string): string {
  return translations[activeLanguage][key] ?? translations.en[key] ?? fallback ?? key;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<SupportedLanguage>(readStoredLanguage);

  useEffect(() => {
    activeLanguage = language;
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Persisting the language preference is best-effort only.
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(prev => {
      const idx = LANGUAGE_ORDER.indexOf(prev);
      return LANGUAGE_ORDER[(idx + 1) % LANGUAGE_ORDER.length];
    }),
    t: (key: string, fallback?: string) => {
      return translations[language][key] ?? translations.en[key] ?? fallback ?? key;
    }
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
