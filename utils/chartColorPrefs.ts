import { useCallback, useRef, useState } from 'react';

/**
 * Central read/write for the per-view chart appearance preferences.
 *
 * The localStorage keys are UNCHANGED (identical strings to what the views used
 * before) so existing user preferences survive. Every localStorage access is
 * wrapped in try/catch: private mode and blocked storage both throw.
 */
export type ChartPrefKey =
  | 'dashboard_chartColors'
  | 'dashboard_kpiColors'
  | 'dashboard_headingFontSize'
  | 'totalView_chartColors'
  | 'monthly_chartColors'
  | 'longTermPlan_chartColors';

/**
 * `migrate` receives the raw JSON-parsed value and returns the value to use, or
 * null to fall back to `defaults`. Use it for legacy shapes (e.g. the old
 * `Record<string, string>` colour maps that are now `SeriesStyle` objects) and
 * to merge in fields added since the preference was last saved.
 */
export function loadChartPref<T>(key: ChartPrefKey, defaults: T, migrate?: (raw: unknown) => T | null): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return defaults;
  }

  if (raw === null || raw === '') return defaults;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }

  if (migrate) {
    const migrated = migrate(parsed);
    return migrated === null ? defaults : migrated;
  }

  if (parsed === null || parsed === undefined) return defaults;
  return parsed as T;
}

export function saveChartPref<T>(key: ChartPrefKey, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persisting chart preferences is best-effort only.
  }
}

export function clearChartPref(key: ChartPrefKey): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — the value simply stays.
  }
}

/** useState-like; persists on every set; safe when localStorage throws. */
export function useChartPref<T>(
  key: ChartPrefKey,
  defaults: T,
  migrate?: (raw: unknown) => T | null,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const defaultsRef = useRef(defaults);
  const [value, setValue] = useState<T>(() => loadChartPref(key, defaults, migrate));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue(prev => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : (next as T);
        // Writing here keeps storage in step with every set(); the write is
        // idempotent so React's dev-mode double invocation is harmless.
        saveChartPref(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    clearChartPref(key);
    setValue(defaultsRef.current);
  }, [key]);

  return [value, set, reset];
}

/** Mid-tone colours legible on both bg-white and bg-slate-900. */
export const CHART_PALETTE = {
  plan: '#3b82f6',
  actual: '#10b981',
  plan2: '#6366f1',
  actual2: '#f59e0b',
  capacity: '#f43f5e',
  neutral: '#94a3b8',
  labelNeutral: '#64748b',
  grid: 'rgba(148,163,184,0.25)',
} as const;
