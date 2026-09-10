import { useEffect, useMemo, useRef, useState } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';

const log = createLogger('MonthlyPlanActualView');

/** One column of the plan-vs-actual chart. */
export interface MonthlyPlanActualData {
  month: number;
  monthLabel: string;
  capacityLine: number;        // 能力線
  workingHoursPlan: number;    // 稼働計画
  workingHoursActual: number;  // 稼働実績
  salesPlan: number;           // 売上計画 (万円)
  salesActual: number;         // 売上実績 (万円)
}

interface MonthlyAggregate {
  month: number;
  workingHoursPlan: number;
  workingHoursActual: number;
  salesPlan: number;
  salesActual: number;
}

export interface MonthlyPlanActualDataset {
  loading: boolean;
  monthlyData: MonthlyPlanActualData[];
  /** Sales axis top, +10% headroom so the labels are not clipped. */
  maxSales: number;
  /** Working-hours axis top, same headroom. */
  maxWorkingHours: number;
}

const localeFor = (language: string): string =>
  language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';

/**
 * The year's plan-vs-actual figures.
 *
 * Split from the chart so the fetch is readable on its own, and so the month
 * LABELS can be recomputed from `language` without refetching: the aggregates
 * are the same numbers in every language, and a language switch used to throw
 * away the whole year and ask the database for it again.
 */
export function useMonthlyPlanActualData(currentYear: number): MonthlyPlanActualDataset {
  const { language, t } = useLanguage();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<MonthlyAggregate[]>([]);
  const [capacities, setCapacities] = useState<{ month: number; capacity: number }[]>([]);

  // `t` is memoised per language; reading it through a ref keeps the fetch tied
  // to the year alone while the error toast stays localised.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    // U1 routed every view's year through one shell control, so a user can change
    // year faster than a request completes. Without this guard an older response
    // lands after a newer one and the view shows the wrong year's numbers.
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        // getCapacityLine(year) returns the real weekday count for `year` (WS-1).
        const [aggregatedData, capacityData] = await Promise.all([
          dbService.getMonthlyAggregatedData(currentYear),
          dbService.getCapacityLine(currentYear),
        ]);

        if (cancelled) return; // superseded by a newer year
        setAggregates(aggregatedData);
        setCapacities(capacityData);
      } catch (error) {
        if (cancelled) return;
        log.error('Failed to load monthly plan-actual data:', error);
        toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [currentYear, toast]);

  const monthlyData = useMemo<MonthlyPlanActualData[]>(() => {
    const locale = localeFor(language);
    return aggregates.map(data => {
      const capacity = capacities.find(c => c.month === data.month)?.capacity || 0;
      const monthLabel = new Date(currentYear, data.month - 1).toLocaleString(locale, { month: 'short' });

      return {
        month: data.month,
        monthLabel: language === 'ja' ? `${data.month}月` : monthLabel,
        capacityLine: capacity,
        workingHoursPlan: data.workingHoursPlan,
        workingHoursActual: data.workingHoursActual,
        salesPlan: data.salesPlan,
        salesActual: data.salesActual,
      };
    });
  }, [aggregates, capacities, currentYear, language]);

  const maxSales = useMemo(() => {
    const max = Math.max(0, ...monthlyData.map(d => Math.max(d.salesPlan, d.salesActual)));
    return Math.ceil(max * 1.1);
  }, [monthlyData]);

  const maxWorkingHours = useMemo(() => {
    const max = Math.max(0, ...monthlyData.map(d => Math.max(d.capacityLine, d.workingHoursPlan, d.workingHoursActual)));
    return Math.ceil(max * 1.1);
  }, [monthlyData]);

  return { loading, monthlyData, maxSales, maxWorkingHours };
}
