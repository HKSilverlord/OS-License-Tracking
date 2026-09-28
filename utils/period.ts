import type { TranslateFn } from '../contexts/LanguageContext';

export type Half = 'H1' | 'H2';

export interface PeriodParts {
  year: number;
  half: Half;
}

/** '2026-H1' -> { year: 2026, half: 'H1' }; null for anything that is not a period label. */
export const parsePeriod = (label: string): PeriodParts | null => {
  const match = /^(\d{4})-(H[12])$/.exec(label);
  return match ? { year: Number(match[1]), half: match[2] as Half } : null;
};

export const periodLabel = ({ year, half }: PeriodParts): string => `${year}-${half}`;

/** The half-year after this one. */
export const nextPeriod = ({ year, half }: PeriodParts): PeriodParts =>
  half === 'H1' ? { year, half: 'H2' } : { year: year + 1, half: 'H1' };

/** 'Jan–Jun' / '1月〜6月' — the months a half covers, in the UI language. */
export const halfMonths = (half: Half, t: TranslateFn): string =>
  half === 'H1'
    ? t('periodManagement.monthRange.h1', 'Jan–Jun')
    : t('periodManagement.monthRange.h2', 'Jul–Dec');

/** '2026-H1' -> '2026 H1 (Jan–Jun)'. Unrecognised labels come back unchanged. */
export const describePeriod = (label: string, t: TranslateFn): string => {
  const parts = parsePeriod(label);
  return parts ? `${parts.year} ${parts.half} (${halfMonths(parts.half, t)})` : label;
};
