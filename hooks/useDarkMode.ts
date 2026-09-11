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

/**
 * Read-only counterpart to `useDarkMode`: reports the theme that is on <html>
 * right now without owning it, and re-renders when it changes.
 *
 * Charts need the boolean in JS rather than as a Tailwind `dark:` class,
 * because an SVG tick or grid line is styled through a `fill`/`stroke` prop
 * that no class can reach.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
