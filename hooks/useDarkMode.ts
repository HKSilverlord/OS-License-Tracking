import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';

const readInitialPreference = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved === 'dark';
  } catch {
    // Blocked storage (private mode) — fall through to the OS preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Tailwind is configured for class-based dark mode, so the theme is the `dark`
 * class on <html> and nothing else. The user's choice is remembered; with no
 * stored choice the OS preference decides.
 */
export function useDarkMode(): [boolean, (next: boolean) => void] {
  const [darkMode, setDarkMode] = useState<boolean>(readInitialPreference);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Persisting the theme is best-effort only.
    }
  }, [darkMode]);

  return [darkMode, setDarkMode];
}
