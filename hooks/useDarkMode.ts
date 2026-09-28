import { useEffect, useState } from 'react';
import { isExportThemeActive, subscribeExportTheme } from '../utils/exportPrefs';

/**
 * Reports the theme that is on <html> right now without owning it, and
 * re-renders when it changes. The theme itself belongs to `ThemeProvider`.
 *
 * Charts need the boolean in JS rather than as a Tailwind `dark:` class,
 * because an SVG tick or grid line is styled through a `fill`/`stroke` prop
 * that no class can reach.
 *
 * Reports light while an export is running on a light background, so those
 * same props follow the image out instead of staying dark-mode pale.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== 'undefined'
      && document.documentElement.classList.contains('dark')
      && !isExportThemeActive()
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark') && !isExportThemeActive());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    const unsubscribe = subscribeExportTheme(sync);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return isDark;
}
