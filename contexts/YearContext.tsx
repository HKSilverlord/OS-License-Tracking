import React, { createContext, useContext, useMemo } from 'react';

interface YearContextValue {
  year: number;
  /** Every year that has a period, newest first. */
  years: number[];
  /** Every period label ('2025-H1'), for the few controls that work per half. */
  periods: string[];
  /**
   * Switch year, after the navigation guard has had its say. Resolves false
   * when the user chose to stay with unsaved edits in Tracking.
   */
  requestYear: (next: number) => Promise<boolean>;
}

const YearContext = createContext<YearContextValue | null>(null);

/**
 * The shell's year, handed to the page headers that show the year control.
 *
 * The year is still passed to each view as a prop — that is what drives its
 * data — this only lets the control live in the page header, next to the
 * content it changes, instead of in a bar shared by pages it does nothing on.
 */
export const YearProvider: React.FC<YearContextValue & { children: React.ReactNode }> = ({
  year,
  years,
  periods,
  requestYear,
  children,
}) => {
  const value = useMemo(() => ({ year, years, periods, requestYear }), [year, years, periods, requestYear]);
  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
};

/** Null outside the shell (the chart harness), where there is no year to pick. */
export function useYearControl(): YearContextValue | null {
  return useContext(YearContext);
}
