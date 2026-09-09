
import { PeriodType } from '../types';

export const formatCurrency = (amount: number, currency: string = 'JPY') => {
  if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
};

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

export const calculateProjectStats = (records: any[], unitPrice: number) => {
  const actualHours = records.reduce((acc, r) => acc + (r.actual_hours || 0), 0);
  const plannedHours = records.reduce((acc, r) => acc + (r.planned_hours || 0), 0);
  return {
    actualHours,
    plannedHours,
    revenue: actualHours * unitPrice
  };
};
