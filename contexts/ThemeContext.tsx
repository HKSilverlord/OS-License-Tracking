import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** What the user picked. `system` follows the OS, live. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Same key the old light/dark toggle wrote, so a saved choice carries over. */
const STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const readPreference = (): ThemePreference => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Blocked storage (private mode): follow the OS.
  }
  return 'system';
};

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** The theme actually on screen once `system` is resolved. */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Owns the `dark` class on <html> — Tailwind's dark mode is class-based, so that
 * class is the whole theme.
 *
 * `index.html` applies the saved theme before React mounts; this provider takes
 * over from there and keeps `system` in step with the OS while the app is open.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Remembering the choice is best-effort; this session still honours it.
    }
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference, isDark }),
    [preference, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
