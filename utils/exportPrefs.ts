/**
 * Preferences for what an exported image looks like, and the switch that puts
 * the app into "export theme" for the moment a capture runs.
 *
 * Separate from `chartColorPrefs` on purpose: these are read from plain
 * functions in `chartExport`, which cannot call a hook, so the store lives here
 * and React subscribes to it rather than the other way round.
 */
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'export_prefs';

export interface ExportPrefs {
  /**
   * Export on a light background even while the app is in dark mode.
   *
   * On by default: an image is nearly always on its way into a slide, a
   * document or a chat message, all of which are light, and a slate-900 plate
   * dropped into one reads as a mistake.
   */
  lightBackground: boolean;
}

const DEFAULTS: ExportPrefs = { lightBackground: true };

const read = (): ExportPrefs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ExportPrefs>;
    return { lightBackground: parsed.lightBackground ?? DEFAULTS.lightBackground };
  } catch {
    // Blocked or corrupt storage: the defaults are a fine answer.
    return DEFAULTS;
  }
};

let prefs: ExportPrefs = read();
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach(fn => fn());

export const getExportPrefs = (): ExportPrefs => prefs;

export const setExportPrefs = (patch: Partial<ExportPrefs>): void => {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Persisting is best-effort; the session still honours the choice.
  }
  notify();
};

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** `[prefs, update]`, re-rendering whoever reads it when the store changes. */
export function useExportPrefs(): [ExportPrefs, (patch: Partial<ExportPrefs>) => void] {
  const value = useSyncExternalStore(subscribe, getExportPrefs, getExportPrefs);
  const update = useCallback((patch: Partial<ExportPrefs>) => setExportPrefs(patch), []);
  return [value, update];
}

/* ------------------------------------------------------------------------- */

/**
 * While a capture runs with `lightBackground` on, the app pretends it is in
 * light mode. Tailwind colours are handled by dropping the `dark` class inside
 * html2canvas' cloned document, but a Recharts axis is coloured through a
 * `fill`/`stroke` prop that no class can reach — those components read the
 * theme through `useIsDarkTheme`, which consults this flag.
 */
let exportThemeActive = false;
const themeListeners = new Set<() => void>();

export const isExportThemeActive = (): boolean => exportThemeActive;

export const subscribeExportTheme = (fn: () => void): (() => void) => {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
};

const setExportThemeActive = (active: boolean): void => {
  if (exportThemeActive === active) return;
  exportThemeActive = active;
  themeListeners.forEach(fn => fn());
};

/** True when this export should be rendered light despite a dark UI. */
export const exportsOnLightBackground = (): boolean =>
  prefs.lightBackground && document.documentElement.classList.contains('dark');

/**
 * Give React time to re-render the charts and the browser time to lay them out.
 *
 * Two frames, then a macrotask: React schedules normal-priority work through a
 * MessageChannel, which runs as a macrotask, so a `setTimeout` after the frames
 * lands behind the commit. html2canvas reads the DOM the instant it is handed
 * the element, and a capture started too early comes out in the wrong palette.
 */
const nextPaint = (): Promise<void> =>
  new Promise(resolve => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, 0)));
  });

/**
 * Cover `element` while its palette is swapped out from under it.
 *
 * Switching to the export theme repaints the live chart: its axis text turns
 * dark while the panel behind it is still dark mode, so for the second or two a
 * capture takes, the labels read as missing. A blurred wash over just that
 * element hides the swap and doubles as a "working on it" signal. The veil is a
 * sibling of the capture target, so it never reaches the image.
 */
const veilOver = (element: HTMLElement): (() => void) => {
  const doc = element.ownerDocument;
  const rect = element.getBoundingClientRect();
  const dark = doc.documentElement.classList.contains('dark');
  const veil = doc.createElement('div');
  veil.setAttribute('data-html2canvas-ignore', '');
  veil.setAttribute('aria-hidden', 'true');
  Object.assign(veil.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '9998',
    pointerEvents: 'none',
    backdropFilter: 'blur(6px)',
    backgroundColor: dark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)',
  });
  doc.body.appendChild(veil);
  return () => veil.remove();
};

/**
 * Run `capture` with the app in export theme, then put it back.
 *
 * Two frames of slack before capturing: one for React to re-render the charts
 * with the light palette, one for the browser to paint it. Restoring in
 * `finally` matters — a throw mid-capture must not strand the UI in the wrong
 * theme, or leave the veil up over a chart nobody can then read.
 */
export const withExportTheme = async <T>(
  element: HTMLElement,
  capture: () => Promise<T>
): Promise<T> => {
  if (!exportsOnLightBackground()) return capture();
  const removeVeil = veilOver(element);
  setExportThemeActive(true);
  try {
    await nextPaint();
    return await capture();
  } finally {
    setExportThemeActive(false);
    removeVeil();
  }
};
