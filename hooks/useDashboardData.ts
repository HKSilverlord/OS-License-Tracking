import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbService } from '../services/dbService';
import { buildPriceIndex, lookupPrices } from '../services/pricing';
import type { PriceIndex } from '../services/pricing';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from '../contexts/ToastContext';
import { DEFAULT_UNIT_PRICE } from '../constants';
import { createLogger } from '../utils/logger';
import type { AccumulatedStats, DashboardRecord, MonthlyStats } from '../types';

const log = createLogger('Dashboard');

const EMPTY_PRICE_INDEX: PriceIndex = buildPriceIndex([], []);

interface PricedRecord {
  plannedHours: number;
  actualHours: number;
  plannedRevenue: number;
  actualRevenue: number;
}

/**
 * THE single pricing code path for the dashboard.
 *
 * A2: the price is resolved per (period_label, project_id) — a project whose H1
 * price differs from its H2 price is priced correctly in each half — using the
 * frozen resolution rule in services/pricing.ts.
 *
 * INVARIANT: every revenue number the dashboard renders is built by summing
 * `priceRecord()` over `rawRecords`. The monthly buckets are the only
 * accumulator and the gross KPI is the sum of those buckets, so
 * `Σ monthly plannedRevenue === grossRevenuePlan` and
 * `Σ monthly actualRevenue === grossRevenueActual` hold by construction — they
 * are literally the same additions.
 */
const priceRecord = (record: DashboardRecord, index: PriceIndex): PricedRecord => {
  const plannedHours = Number(record.planned_hours) || 0;
  const actualHours = Number(record.actual_hours) || 0;
  const prices = lookupPrices(index, record.period_label, record.project_id);
  return {
    plannedHours,
    actualHours,
    plannedRevenue: plannedHours * prices.plan,
    actualRevenue: actualHours * prices.actual,
  };
};

export interface DashboardData {
  loading: boolean;
  /** Raw rows, exposed only so the view can tell "no data" from "all zeroes". */
  rawRecords: DashboardRecord[];
  stats: MonthlyStats[];
  accumulatedStats: AccumulatedStats[];

  exchangeRate: number;
  unitPrice: number;
  licenseComputers: number;
  licensePerComputer: number;

  handleRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUnitPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLicenseComputersChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLicensePerComputerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Everything the Dashboard needs from the database, and nothing it needs from
 * the DOM. Split out of Dashboard.tsx so the fetch/race/pricing logic can be
 * read without scrolling past 700 lines of charts.
 */
export function useDashboardData(currentYear: number): DashboardData {
  const { language, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [rawRecords, setRawRecords] = useState<DashboardRecord[]>([]);
  const [priceIndex, setPriceIndex] = useState<PriceIndex>(EMPTY_PRICE_INDEX);

  const [exchangeRate, setExchangeRate] = useState(172);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_UNIT_PRICE);
  const [licenseComputers, setLicenseComputers] = useState(7);
  const [licensePerComputer, setLicensePerComputer] = useState(2517143);

  // `t` is memoised per language; keeping it in a ref keeps `loadDashboard`
  // stable across language switches so the year is the only refetch trigger.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // U1 routed every view's year through one shell control, so a user can change
  // year faster than a request completes. Without this guard an older response
  // lands after a newer one and the view shows the wrong year's numbers.
  const loadSeqRef = useRef(0);

  /**
   * A5: one settings call + one records call + ONE `getYearProjectPrices` call
   * (≤ 3 Supabase requests) replaces the previous getPeriods() + getProjects(period)
   * per-period request storm.
   */
  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++loadSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const [settings, records, yearPrices] = await Promise.all([
        dbService.getSettings(),
        dbService.getDashboardStats(currentYear),
        dbService.getYearProjectPrices(currentYear),
      ]);

      if (seq !== loadSeqRef.current) return; // superseded by a newer year
      if (typeof settings.exchangeRate === 'number') setExchangeRate(settings.exchangeRate);
      if (typeof settings.licenseComputers === 'number') setLicenseComputers(settings.licenseComputers);
      if (typeof settings.licensePerComputer === 'number') setLicensePerComputer(settings.licensePerComputer);
      if (typeof settings.unitPrice === 'number') setUnitPrice(settings.unitPrice);

      setRawRecords(records);
      setPriceIndex(yearPrices.index);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load dashboard data', error);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear]);

  // U1: the load re-runs whenever the shell's year changes.
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // U2: hours saved in /tracking (and newly created periods) refresh the KPIs.
  useEffect(() => {
    // Refresh in place — no skeleton flash for an event-driven update.
    const handleRefresh = () => {
      void loadDashboard({ silent: true });
    };
    window.addEventListener('dataUpdated', handleRefresh);
    window.addEventListener('periodCreated', handleRefresh);
    return () => {
      window.removeEventListener('dataUpdated', handleRefresh);
      window.removeEventListener('periodCreated', handleRefresh);
    };
  }, [loadDashboard]);

  const stats = useMemo<MonthlyStats[]>(() => {
    const locale = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';
    const monthly: MonthlyStats[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: new Date(currentYear, i).toLocaleString(locale, { month: 'short' }),
      plannedHours: 0,
      actualHours: 0,
      plannedRevenue: 0,
      actualRevenue: 0,
    }));

    for (const record of rawRecords) {
      if (record.month < 1 || record.month > 12) continue;
      const priced = priceRecord(record, priceIndex);
      const target = monthly[record.month - 1];
      target.plannedHours += priced.plannedHours;
      target.actualHours += priced.actualHours;
      target.plannedRevenue += priced.plannedRevenue;
      target.actualRevenue += priced.actualRevenue;
    }

    return monthly;
  }, [rawRecords, priceIndex, language, currentYear]);

  const accumulatedStats = useMemo<AccumulatedStats[]>(() => {
    let accPlan = 0;
    let accActual = 0;
    return stats.map(d => {
      accPlan += d.plannedRevenue;
      accActual += d.actualRevenue;
      return { month: d.name, accPlannedRevenue: accPlan, accActualRevenue: accActual };
    });
  }, [stats]);

  // Each setting is written straight back so a reload shows the same number.
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setExchangeRate(val);
    dbService.saveSettings({ exchangeRate: val });
  };

  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setUnitPrice(val);
    dbService.saveSettings({ unitPrice: val });
  };

  const handleLicenseComputersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setLicenseComputers(val);
    dbService.saveSettings({ licenseComputers: val });
  };

  const handleLicensePerComputerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setLicensePerComputer(val);
    dbService.saveSettings({ licensePerComputer: val });
  };

  return {
    loading,
    rawRecords,
    stats,
    accumulatedStats,
    exchangeRate,
    unitPrice,
    licenseComputers,
    licensePerComputer,
    handleRateChange,
    handleUnitPriceChange,
    handleLicenseComputersChange,
    handleLicensePerComputerChange,
  };
}
