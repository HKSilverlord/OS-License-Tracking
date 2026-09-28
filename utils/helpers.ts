
import { PeriodType } from '../types';

export const getCurrentPeriod = (): { year: number; type: PeriodType; label: string } => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const type = month <= 6 ? PeriodType.H1 : PeriodType.H2;
  return {
    year,
    type,
    label: `${year}-${type}`
  };
};

/**
 * Calendar months covered by a half-year period.
 * The calendar year is irrelevant here — H1 is always Jan–Jun and H2 Jul–Dec —
 * so the signature only takes the period type.
 */
export const getMonthsForPeriod = (type: PeriodType): number[] => {
  return type === PeriodType.H1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
};
