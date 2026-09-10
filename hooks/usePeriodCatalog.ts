import { useCallback, useEffect, useRef, useState } from 'react';
import { dbService } from '../services/dbService';
import { createLogger } from '../utils/logger';

const log = createLogger('periods');

/** '2025-H1' -> 2025; NaN for anything that is not a period label. */
const yearOf = (periodLabel: string): number => parseInt(periodLabel.split('-')[0], 10);

const yearsFrom = (periods: string[]): number[] =>
  Array.from(new Set(periods.map(yearOf).filter(y => !isNaN(y)))).sort((a, b) => b - a);

export interface PeriodCatalog {
  /** Every period label, kept whole because the modals need the H1/H2 halves. */
  availablePeriods: string[];
  availableYears: number[];
  currentYear: number;
  setCurrentYear: (year: number) => void;
  /** Re-read the list after a period is created, and jump to its year. */
  refreshFor: (periodLabel: string) => Promise<void>;
}

/**
 * The year/period catalogue behind the shell's year picker.
 *
 * Keyed on `userId`, not on the session object: Supabase hands out a NEW session
 * object on every token refresh (roughly hourly), and keying on that re-ran this
 * load and snapped the year picker back to the default — silently moving the
 * user off the year they were reading. The picked year is also defaulted only
 * once per user, for the same reason.
 */
export function usePeriodCatalog(userId: string | null): PeriodCatalog {
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  const hasDefaultedYear = useRef(false);

  const load = useCallback(async (): Promise<string[]> => {
    const periods = await dbService.getPeriods();
    setAvailablePeriods(periods);
    setAvailableYears(yearsFrom(periods));
    return periods;
  }, []);

  useEffect(() => {
    if (!userId) return;
    hasDefaultedYear.current = false;

    let cancelled = false;
    void (async () => {
      try {
        const periods = await load();
        if (cancelled) return;

        const years = yearsFrom(periods);
        if (years.length > 0 && !hasDefaultedYear.current) {
          hasDefaultedYear.current = true;
          // Prefer the real current year, else the most recent year with data.
          const realYear = new Date().getFullYear();
          setCurrentYear(years.includes(realYear) ? realYear : years[0]);
        }
      } catch (error) {
        if (!cancelled) log.error('Failed to load the period list', error);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, load]);

  const refreshFor = useCallback(async (periodLabel: string) => {
    await load();
    const year = yearOf(periodLabel);
    if (!isNaN(year)) {
      hasDefaultedYear.current = true;
      setCurrentYear(year);
    }
  }, [load]);

  // A period created anywhere in the app (including another view) lands here.
  useEffect(() => {
    const handlePeriodCreated = (event: Event) => {
      const detail = (event as CustomEvent<{ periodLabel?: string }>).detail;
      void refreshFor(detail?.periodLabel ?? '');
    };

    window.addEventListener('periodCreated', handlePeriodCreated);
    return () => window.removeEventListener('periodCreated', handlePeriodCreated);
  }, [refreshFor]);

  return { availablePeriods, availableYears, currentYear, setCurrentYear, refreshFor };
}
