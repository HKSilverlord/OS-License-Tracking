import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../utils/helpers';
import type { AccumulatedStats, DashboardRecord, MonthlyStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line, LabelList } from 'recharts';
import { TrendingUp, JapaneseYen, Clock, Calculator, Palette } from 'lucide-react';
import { ChartExportMenu } from './ChartExportMenu';
import { SectionExportMenu } from './SectionExportMenu';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { toast } from '../contexts/ToastContext';
import { DEFAULT_UNIT_PRICE } from '../constants';
import { computeYearlyCost, useCatiaStore } from '../stores/useCatiaStore';
import { buildPriceIndex, lookupPrices } from '../services/pricing';
import type { PriceIndex } from '../services/pricing';
import { CHART_PALETTE, useChartPref } from '../utils/chartColorPrefs';
import { Card } from '../src/ui/components/Card';
import { KpiCard } from '../src/ui/components/KpiCard';
import { Skeleton } from '../src/ui/components/Skeleton';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { createLogger } from '../src/core/logger';

const log = createLogger('Dashboard');

export interface DashboardProps {
  /** Single source of truth for the year — owned by the App shell top bar (U1 / C10). */
  currentYear: number;
}

interface DashboardChartColors {
  planRevenue: string;
  actualRevenue: string;
  accPlan: string;
  accActual: string;
}

interface DashboardKpiColors {
  grossPlanFrom: string;
  grossPlanTo: string;
  grossActualFrom: string;
  grossActualTo: string;
  netPlanBorder: string;
  netActualBorder: string;
  licenseFrom: string;
  licenseTo: string;
  costAnalysisBorder: string;
  summaryFrom: string;
  summaryTo: string;
}

/** Chart series defaults come from the shared, theme-safe palette (U8 / C7). */
const DEFAULT_CHART_COLORS: DashboardChartColors = {
  planRevenue: CHART_PALETTE.neutral,
  actualRevenue: CHART_PALETTE.plan,
  accPlan: CHART_PALETTE.neutral,
  accActual: CHART_PALETTE.actual,
};

const CHART_COLOR_KEYS = ['planRevenue', 'actualRevenue', 'accPlan', 'accActual'] as const;

const DEFAULT_KPI_COLORS: DashboardKpiColors = {
  grossPlanFrom: '#0ea5e9', // sky-500
  grossPlanTo: '#0284c7', // sky-600
  grossActualFrom: '#10b981', // emerald-500
  grossActualTo: '#14b8a6', // teal-500
  netPlanBorder: '#ccfbf1', // teal-100
  netActualBorder: '#10b981', // emerald-500
  licenseFrom: '#0d9488', // teal-600
  licenseTo: '#10b981', // emerald-500
  costAnalysisBorder: '#fef3c7', // amber-100
  summaryFrom: '#334155', // slate-700
  summaryTo: '#0d9488', // teal-600
};

const KPI_COLOR_KEYS = [
  'grossPlanFrom', 'grossPlanTo', 'grossActualFrom', 'grossActualTo',
  'netPlanBorder', 'netActualBorder', 'licenseFrom', 'licenseTo',
  'costAnalysisBorder', 'summaryFrom', 'summaryTo',
] as const;

const DEFAULT_HEADING_FONT_SIZE = 18;
const MIN_HEADING_FONT_SIZE = 10;
const MAX_HEADING_FONT_SIZE = 22;

const DASHBOARD_EXPORT_SECTIONS = [
  { id: 'section-kpi-summary', labelKey: 'export.kpiSummary', defaultLabel: '業績ハイライト (KPI〜ライセンス)' },
  { id: 'section-cost-analysis', labelKey: 'export.costAnalysis', defaultLabel: 'コスト分析' },
  { id: 'section-financial-summary', labelKey: 'export.financialSummary', defaultLabel: '財務サマリー' },
];

/* ------------------------------------------------------------------ *
 * Stored-preference migration (U8) — the localStorage keys are unchanged
 * so preferences saved by the previous implementation keep working.
 * ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readColor = (raw: Record<string, unknown>, key: string, fallback: string): string => {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const migrateChartColors = (raw: unknown): DashboardChartColors | null => {
  if (!isRecord(raw)) return null;
  const merged: DashboardChartColors = { ...DEFAULT_CHART_COLORS };
  for (const key of CHART_COLOR_KEYS) {
    merged[key] = readColor(raw, key, DEFAULT_CHART_COLORS[key]);
  }
  return merged;
};

const migrateKpiColors = (raw: unknown): DashboardKpiColors | null => {
  if (!isRecord(raw)) return null;
  const merged: DashboardKpiColors = { ...DEFAULT_KPI_COLORS };
  for (const key of KPI_COLOR_KEYS) {
    merged[key] = readColor(raw, key, DEFAULT_KPI_COLORS[key]);
  }
  return merged;
};

/** The old code stored the raw integer ("18"), which JSON.parse still reads as a number. */
const migrateHeadingFontSize = (raw: unknown): number | null => {
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string'
      ? Number.parseInt(raw, 10)
      : Number.NaN;
  if (!Number.isFinite(value)) return null;
  return Math.min(MAX_HEADING_FONT_SIZE, Math.max(MIN_HEADING_FONT_SIZE, Math.round(value)));
};

/* ------------------------------------------------------------------ *
 * Animation variants (framer-motion `Variants` — `transition.type` has to
 * be the literal 'spring', not the widened `string`).
 * ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

/* ------------------------------------------------------------------ *
 * Money maths — ONE code path (A2 / A5)
 * ------------------------------------------------------------------ */

const EMPTY_PRICE_INDEX: PriceIndex = buildPriceIndex([], []);

interface PricedRecord {
  plannedHours: number;
  actualHours: number;
  plannedRevenue: number;
  actualRevenue: number;
}

/**
 * THE single pricing code path for this view.
 *
 * A2: the price is resolved per (period_label, project_id) — a project whose H1
 * price differs from its H2 price is now priced correctly in each half — using
 * the frozen resolution rule in services/pricing.ts.
 *
 * INVARIANT: every revenue number rendered by this component is built by
 * summing `priceRecord()` over `rawRecords`. The monthly buckets are the only
 * accumulator; the gross KPI is the sum of those buckets (see `stats` /
 * `grossRevenuePlan` below), so `Σ monthly plannedRevenue === grossRevenuePlan`
 * and `Σ monthly actualRevenue === grossRevenueActual` hold by construction —
 * they are literally the same additions.
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

/* ------------------------------------------------------------------ *
 * Small presentational helpers
 * ------------------------------------------------------------------ */

/** recharts 3 `LabelFormatter` receives `RenderableText`, which is not exported from the package root. */
type ChartLabelValue = string | number | boolean | null | undefined;

/** Bar/line data labels stay in 万 (10k JPY) units, exactly as before. */
const manLabel = (value: ChartLabelValue): string =>
  typeof value === 'number' && value > 0 ? (value / 10000).toFixed(0) : '';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  labelClassName?: string;
}

const ColorField: React.FC<ColorFieldProps> = ({
  label,
  value,
  onChange,
  labelClassName = 'text-[10px] uppercase text-slate-500 dark:text-slate-400',
}) => (
  <div className="flex flex-col gap-1 flex-1">
    <label className={labelClassName}>{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
      />
    </div>
  </div>
);

const ColorGroup: React.FC<{ title: string; className?: string; children: React.ReactNode }> = ({
  title,
  className = '',
  children,
}) => (
  <div className={`bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700 ${className}`}>
    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{title}</p>
    {children}
  </div>
);

const KpiSkeletonCard: React.FC = () => (
  <Card className="p-5 space-y-3">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-20" />
  </Card>
);

/* ------------------------------------------------------------------ */

export const Dashboard: React.FC<DashboardProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const { isAdmin, role } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [rawRecords, setRawRecords] = useState<DashboardRecord[]>([]);
  const [priceIndex, setPriceIndex] = useState<PriceIndex>(EMPTY_PRICE_INDEX);

  const [exchangeRate, setExchangeRate] = useState(172);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_UNIT_PRICE);
  const [licenseComputers, setLicenseComputers] = useState(7);
  const [licensePerComputer, setLicensePerComputer] = useState(2517143);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showKpiColorPicker, setShowKpiColorPicker] = useState(false);

  const [chartColors, setChartColors] = useChartPref<DashboardChartColors>(
    'dashboard_chartColors', DEFAULT_CHART_COLORS, migrateChartColors,
  );
  const [dashboardColors, setDashboardColors, resetDashboardColors] = useChartPref<DashboardKpiColors>(
    'dashboard_kpiColors', DEFAULT_KPI_COLORS, migrateKpiColors,
  );
  const [headingFontSize, setHeadingFontSize] = useChartPref<number>(
    'dashboard_headingFontSize', DEFAULT_HEADING_FONT_SIZE, migrateHeadingFontSize,
  );

  // A4 (D6): select the computed NUMBER, never the stable `getYearlyCost` function —
  // selecting the function reference means the KPI never re-renders on CATIA edits.
  const licenseTotal = useCatiaStore(s => computeYearlyCost(s.licenseCosts, currentYear));
  const catiaSyncStatus = useCatiaStore(s => s.syncStatus);

  // A4: the CATIA numbers now live in Supabase — pull them once the role is
  // known. `role` is null until get_my_role() answers, and hydrate() may only
  // publish an empty document for a confirmed admin, so waiting is required.
  useEffect(() => {
    if (role === null) return;
    void useCatiaStore.getState().hydrate({ canSeed: role === 'admin' });
  }, [role]);

  // `t` is memoised per language; keeping it in a ref keeps `loadDashboard`
  // stable across language switches so the year is the only refetch trigger.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const planShort = t('tracker.planShort', 'Plan');
  const actualShort = t('tracker.actualShort', 'Actual');

  /**
   * A5: one settings call + one records call + ONE `getYearProjectPrices` call
   * (≤ 2 Supabase requests) replaces the previous getPeriods() + getProjects(period)
   * per-period request storm.
   */
  // U1 routed every view's year through one shell control, so a user can change
  // year faster than a request completes. Without this guard an older response
  // lands after a newer one and the view shows the wrong year's numbers.
  const loadSeqRef = useRef(0);

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

  // U6: a Skeleton shell instead of a bare centred spinner.
  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={t('common.loading', 'Loading…')}
        className="h-full overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="p-4">
            <div className="flex flex-col lg:flex-row justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="h-16 w-full lg:w-96" />
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <KpiSkeletonCard key={`kpi-${i}`} />)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <KpiSkeletonCard key={`gross-${i}`} />)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
            {[0, 1].map(i => (
              <Card key={`chart-${i}`} className="p-5 space-y-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-72 w-full" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // U1: the empty state now follows the shell's year instead of a private year list.
  if (rawRecords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow rounded-lg p-6 text-center">
          <p className="text-slate-600 dark:text-slate-300 text-sm">
            {t('dashboard.noDataForYear', 'No data for {year}').replace('{year}', String(currentYear))}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">{t('dashboard.empty')}</p>
        </div>
      </div>
    );
  }

  const totalPlanHours = stats.reduce((acc, curr) => acc + curr.plannedHours, 0);
  const totalActualHours = stats.reduce((acc, curr) => acc + curr.actualHours, 0);

  // A2 INVARIANT: the gross KPIs are the sum of the very same monthly buckets the
  // chart renders, so Σ monthly revenue === gross revenue exactly (same additions).
  const grossRevenuePlan = stats.reduce((acc, curr) => acc + curr.plannedRevenue, 0);
  const grossRevenueActual = stats.reduce((acc, curr) => acc + curr.actualRevenue, 0);

  const netRevenuePlan = grossRevenuePlan - licenseTotal;
  const netRevenueActual = grossRevenueActual - licenseTotal;
  const achievementRate = totalPlanHours !== 0 ? (totalActualHours / totalPlanHours) * 100 : 0;
  const profitMarginActual = grossRevenueActual !== 0 ? (netRevenueActual / grossRevenueActual) * 100 : 0;
  const licenseCostPerHour = totalPlanHours !== 0 ? licenseTotal / totalPlanHours : 0;
  const netHourlyRate = unitPrice - licenseCostPerHour;
  const breakEvenHours = unitPrice !== 0 ? licenseTotal / unitPrice : 0;
  const remainingHours = Math.max(0, totalPlanHours - totalActualHours);

  const toMan = (val: number) => `${(val / 10000).toFixed(1)}万`;
  const fmt = (val: number) => formatCurrency(val);
  const fmtSigned = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    return `${sign}${formatCurrency(abs)}`;
  };
  const fmtHours = (val: number) => `${Math.round(val).toLocaleString()}h`;

  const gradientSuffix = t('dashboard.colors.gradientSuffix', '(Gradient)');
  const fromLabel = t('dashboard.colors.from', 'From');
  const toLabel = t('dashboard.colors.to', 'To');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Group KPI to License with Header for single export */}
        <div id="section-kpi-summary" className="space-y-6 relative">
          {/* Header & Controls */}
          <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{`${t('header.dashboardTitle', 'Dashboard')} ${currentYear}`}</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.header.desc', 'Review progress and revenue by year')}</p>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
            <SectionExportMenu sections={DASHBOARD_EXPORT_SECTIONS} />
            {isAdmin && (
              <button
                data-html2canvas-ignore="true"
                onClick={() => setShowKpiColorPicker(!showKpiColorPicker)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
                title={t('dashboard.colors.title')}
              >
                <Palette className="w-4 h-4" />
                {t('dashboard.colors.button')}
              </button>
            )}
            <div className="w-full lg:w-auto flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 bg-sky-50 dark:bg-sky-900/20 px-4 py-3 rounded-lg border border-sky-100 dark:border-sky-800">
                <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pb-1">{t('dashboard.fx.label', 'Exchange Rate')}</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 mr-2">1 JPY = </span>
                    <input
                      type="number"
                      disabled={!isAdmin}
                      className="w-20 h-8 text-sm border border-sky-200 dark:border-sky-700 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 disabled:opacity-75 disabled:cursor-not-allowed"
                      value={exchangeRate}
                      onChange={handleRateChange}
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 ml-1">VND</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pb-1">{t('dashboard.fx.hourly', 'Hourly Rate (JPY)')}</span>
                  <input
                    type="number"
                    disabled={!isAdmin}
                    className="w-20 h-8 text-sm border border-sky-200 dark:border-sky-700 rounded px-2 focus:ring-1 focus:ring-sky-500 text-right font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 disabled:opacity-75 disabled:cursor-not-allowed"
                    value={unitPrice}
                    onChange={handleUnitPriceChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider pb-1">{t('dashboard.license.count', 'License Seats')}</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!isAdmin}
                    className="w-full h-9 text-sm border border-emerald-200 dark:border-emerald-700 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 disabled:opacity-75 disabled:cursor-not-allowed"
                    value={licenseComputers}
                    onChange={handleLicenseComputersChange}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider pb-1">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!isAdmin}
                    className="w-full h-9 text-sm border border-emerald-200 dark:border-emerald-700 rounded px-2 focus:ring-1 focus:ring-emerald-500 text-right font-semibold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 disabled:opacity-75 disabled:cursor-not-allowed"
                    value={licensePerComputer}
                    onChange={handleLicensePerComputerChange}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider pb-1">
                    {t('dashboard.license.total', 'Annual License Cost')} (CATIA)
                  </span>
                  <div className="h-9 flex items-center justify-end text-sm font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 px-2 rounded border border-emerald-200 dark:border-emerald-700" title="Dynamically calculated from CATIA License table">
                    {fmt(licenseTotal)} / {toMan(licenseTotal)}
                  </div>
                  {catiaSyncStatus === 'loading' && (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 text-right">{t('dashboard.licenseSyncing', 'Syncing license data…')}</span>
                  )}
                  {catiaSyncStatus === 'error' && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 text-right">{t('catia.syncError', 'Sync failed — showing local values')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard KPI Color Picker Panel */}
        {showKpiColorPicker && (
          <div data-html2canvas-ignore="true" className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-6 flex-wrap">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  {t('dashboard.colors.title', 'Customize Dashboard Colors')}
                </h4>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('dashboard.colors.headingSize', 'Heading Size')}:</label>
                  <input
                    type="range"
                    min={MIN_HEADING_FONT_SIZE}
                    max={MAX_HEADING_FONT_SIZE}
                    step="1"
                    value={headingFontSize}
                    onChange={(e) => setHeadingFontSize(parseInt(e.target.value, 10) || DEFAULT_HEADING_FONT_SIZE)}
                    className="w-24 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-bold w-10 text-right text-slate-700 dark:text-slate-200">{headingFontSize}px</span>
                </div>
              </div>
              <button
                onClick={resetDashboardColors}
                className="text-xs px-3 py-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
              >
                {t('dashboard.colors.reset', 'Reset Defaults')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Gross Plan */}
              <ColorGroup title={`${t('dashboard.gross.plan', 'Gross Revenue (Plan)')} ${gradientSuffix}`}>
                <div className="flex gap-4">
                  <ColorField
                    label={fromLabel}
                    value={dashboardColors.grossPlanFrom}
                    onChange={(grossPlanFrom) => setDashboardColors({ ...dashboardColors, grossPlanFrom })}
                  />
                  <ColorField
                    label={toLabel}
                    value={dashboardColors.grossPlanTo}
                    onChange={(grossPlanTo) => setDashboardColors({ ...dashboardColors, grossPlanTo })}
                  />
                </div>
              </ColorGroup>

              {/* Gross Actual */}
              <ColorGroup title={`${t('dashboard.gross.actual', 'Gross Revenue (Actual)')} ${gradientSuffix}`}>
                <div className="flex gap-4">
                  <ColorField
                    label={fromLabel}
                    value={dashboardColors.grossActualFrom}
                    onChange={(grossActualFrom) => setDashboardColors({ ...dashboardColors, grossActualFrom })}
                  />
                  <ColorField
                    label={toLabel}
                    value={dashboardColors.grossActualTo}
                    onChange={(grossActualTo) => setDashboardColors({ ...dashboardColors, grossActualTo })}
                  />
                </div>
              </ColorGroup>

              {/* License */}
              <ColorGroup title={`${t('dashboard.license.card.subtitle', 'Annual License Fee')} ${gradientSuffix}`}>
                <div className="flex gap-4">
                  <ColorField
                    label={fromLabel}
                    value={dashboardColors.licenseFrom}
                    onChange={(licenseFrom) => setDashboardColors({ ...dashboardColors, licenseFrom })}
                  />
                  <ColorField
                    label={toLabel}
                    value={dashboardColors.licenseTo}
                    onChange={(licenseTo) => setDashboardColors({ ...dashboardColors, licenseTo })}
                  />
                </div>
              </ColorGroup>

              {/* Summary */}
              <ColorGroup title={`${t('dashboard.summary.title', 'Financial Summary')} ${gradientSuffix}`}>
                <div className="flex gap-4">
                  <ColorField
                    label={fromLabel}
                    value={dashboardColors.summaryFrom}
                    onChange={(summaryFrom) => setDashboardColors({ ...dashboardColors, summaryFrom })}
                  />
                  <ColorField
                    label={toLabel}
                    value={dashboardColors.summaryTo}
                    onChange={(summaryTo) => setDashboardColors({ ...dashboardColors, summaryTo })}
                  />
                </div>
              </ColorGroup>

              {/* Solid Borders (Net Plan, Net Actual, Cost) */}
              <ColorGroup title={t('dashboard.colors.cardBorders', 'Card Borders (Solid)')} className="xl:col-span-2">
                <div className="grid grid-cols-3 gap-4">
                  <ColorField
                    label={t('dashboard.net.plan', 'Net Plan')}
                    value={dashboardColors.netPlanBorder}
                    onChange={(netPlanBorder) => setDashboardColors({ ...dashboardColors, netPlanBorder })}
                  />
                  <ColorField
                    label={t('dashboard.net.actual', 'Net Actual')}
                    value={dashboardColors.netActualBorder}
                    onChange={(netActualBorder) => setDashboardColors({ ...dashboardColors, netActualBorder })}
                  />
                  <ColorField
                    label={t('dashboard.costAnalysis.title', 'Cost')}
                    value={dashboardColors.costAnalysisBorder}
                    onChange={(costAnalysisBorder) => setDashboardColors({ ...dashboardColors, costAnalysisBorder })}
                  />
                </div>
              </ColorGroup>
            </div>
          </div>
        )}

        {/* KPI to License wrapper */}
        <div className="space-y-6">
          {/* Row 1: Core KPIs (Hours) */}
          <motion.div variants={itemVariants} id="section-core-kpis" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label={t('dashboard.kpi.planHoursLabel', '計画工数')}
              value={fmtHours(totalPlanHours)}
              subtitle={t('dashboard.kpi.yearTotal', '年度合計')}
              icon={Clock}
              accentColor="sky"
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.actualHoursLabel', '実績工数')}
              value={fmtHours(totalActualHours)}
              subtitle={t('dashboard.kpi.actualHoursDesc', '年間実績合計')}
              icon={Clock}
              accentColor="emerald"
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.varianceLabel', '差異')}
              value={`${fmtHours(Math.abs(totalActualHours - totalPlanHours))}`}
              subtitle={t('dashboard.kpi.varianceDesc')}
              icon={TrendingUp}
              trend={{
                direction: totalActualHours >= totalPlanHours ? 'up' : 'down'
              }}
              headingSize={headingFontSize}
            />
            <KpiCard
              label={t('dashboard.kpi.achievementLabel', '達成率')}
              value={`${achievementRate.toFixed(1)}%`}
              subtitle={`${t('dashboard.kpi.remainingLabel', '残工数')} ${fmtHours(remainingHours)}`}
              icon={TrendingUp}
              accentColor="teal"
              headingSize={headingFontSize}
            />
          </motion.div>

        {/* Row 2: Gross Revenue */}
        <motion.div variants={itemVariants} id="section-gross-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            gradient
            gradientFrom={dashboardColors.grossPlanFrom}
            gradientTo={dashboardColors.grossPlanTo}
            label={t('dashboard.gross.plan', '総売上（計画）')}
            value={fmt(grossRevenuePlan)}
            subtitle={toMan(grossRevenuePlan)}
            icon={JapaneseYen}
            headingSize={headingFontSize}
          />
          <KpiCard
            gradient
            gradientFrom={dashboardColors.grossActualFrom}
            gradientTo={dashboardColors.grossActualTo}
            label={t('dashboard.gross.actual', '総売上（実績）')}
            value={fmt(grossRevenueActual)}
            subtitle={toMan(grossRevenueActual)}
            icon={JapaneseYen}
            headingSize={headingFontSize}
          />
          <Card className={`flex flex-col justify-center p-5 border-2 ${grossRevenueActual >= grossRevenuePlan ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs uppercase tracking-wider font-semibold ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`} style={{ fontSize: `${headingFontSize}px` }}>
                {t('dashboard.kpi.varianceLabel', '差異')}
              </p>
            </div>
            <div className={`mt-3 text-3xl font-bold pb-1 ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              <span className="mr-1 text-2xl">{grossRevenueActual - grossRevenuePlan < 0 ? '▲' : '▼'}</span>
              {fmt(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-medium ${grossRevenueActual >= grossRevenuePlan ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(Math.abs(grossRevenueActual - grossRevenuePlan))}
            </div>
          </Card>
        </motion.div>

        {/* Row 3: Net Revenue (Profit) */}
        <motion.div variants={itemVariants} id="section-net-revenue" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 flex flex-col justify-center border-2 border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <JapaneseYen className="w-32 h-32 text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.net.plan', '利益 目標')}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('dashboard.net.plan.subtitle', '計画売上 - ライセンス')}</p>
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white relative z-10">{fmtSigned(netRevenuePlan)}</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 mt-1 relative z-10">{toMan(netRevenuePlan)}</div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 relative z-10">
              <div className="flex justify-between items-center">
                <span>総額: {toMan(grossRevenuePlan)}</span>
                <span className="text-rose-500 dark:text-rose-400">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-center border-2 border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <JapaneseYen className="w-32 h-32 text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.net.actual', '利益 実績')}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('dashboard.net.actual.subtitle', '実績売上 - ライセンス')}</p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {fmtSigned(netRevenueActual)}
            </div>
            <div className={`text-sm font-semibold mt-1 relative z-10 ${netRevenueActual >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(netRevenueActual)}
            </div>

            <div className="mt-4 text-[11px] font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 relative z-10">
              <div className="flex justify-between items-center">
                <span>総額: {toMan(grossRevenueActual)}</span>
                <span className="text-rose-500 dark:text-rose-400">- ライセンス: {toMan(licenseTotal)}</span>
              </div>
            </div>
          </Card>

          <Card className={`p-5 flex flex-col justify-center border-2 relative overflow-hidden ${netRevenueActual >= netRevenuePlan ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className={`text-xs uppercase tracking-wider font-semibold ${netRevenueActual >= netRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`} style={{ fontSize: `${headingFontSize}px` }}>
                  {t('dashboard.kpi.varianceLabel', '差異')}
                </p>
              </div>
            </div>
            <div className={`mt-4 text-3xl font-bold relative z-10 pb-1 ${netRevenueActual >= netRevenuePlan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              <span className="mr-1 text-2xl">{netRevenueActual < netRevenuePlan ? '▲' : '▼'}</span>
              {fmt(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>
            <div className={`text-sm mt-1 font-semibold relative z-10 ${netRevenueActual >= netRevenuePlan ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {toMan(Math.abs(netRevenueActual - netRevenuePlan))}
            </div>

            <div className={`mt-4 text-[11px] font-mono p-2 rounded-lg border relative z-10 ${netRevenueActual >= netRevenuePlan ? 'bg-emerald-100/50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100/50 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'}`}>
              <div className="flex justify-between items-center">
                <span>実績利益</span>
                <span>- 目標利益</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Row 4: License Card */}
        <motion.div variants={itemVariants}>
          <Card
            id="section-license-card"
            gradient
            fromColor={dashboardColors.licenseFrom}
            toColor={dashboardColors.licenseTo}
          className="p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-teal-100 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.license.card.title', 'CAD License Management')}</p>
              <p className="text-lg font-bold text-white">{t('dashboard.license.card.subtitle', 'Annual License Fee')}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{fmt(licenseTotal)}</div>
              <div className="text-sm text-teal-50">{toMan(licenseTotal)}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.count', 'License Seats')}</div>
              <div className="text-xl font-bold text-white">{licenseComputers.toLocaleString()} <span className="text-base font-medium opacity-80">{t('dashboard.license.units', 'units')}</span></div>
              <div className="text-xs text-teal-50/80 mt-1">{t('dashboard.license.targetPc', 'Target PCs')}</div>
            </div>
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.perSeat', 'Fee per Seat (JPY)')}</div>
              <div className="text-xl font-bold text-white">{fmt(licensePerComputer)}</div>
              <div className="text-xs text-teal-50/80 mt-1">{toMan(licensePerComputer)}</div>
            </div>
            <div className="bg-black/10 dark:bg-black/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-teal-50 font-semibold mb-1">{t('dashboard.license.card.costPerHour', 'Cost per Hour (plan)')}</div>
              <div className="text-xl font-bold text-white">{fmt(Math.max(0, licenseCostPerHour))}</div>
              <div className="text-xs text-teal-50/80 mt-1">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</div>
            </div>
          </div>
          </Card>
        </motion.div>
        </div> {/* End of inner wrapper */}
        </div> {/* End of section-kpi-summary */}

        {/* Row 5: Cost Analysis */}
        <motion.div variants={itemVariants}>
          <Card
          id="section-cost-analysis"
          className="p-5 border-2"
          style={{ borderColor: dashboardColors.costAnalysisBorder }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold" style={{ fontSize: `${headingFontSize}px` }}>{t('dashboard.costAnalysis.title', 'Cost Analysis')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{t('dashboard.costAnalysis.subtitle', 'Understand license impact')}</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 transition-colors">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-500 uppercase">{t('dashboard.costAnalysis.licensePerHour', 'License / Hour')}</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-400 mt-1">{fmt(licenseCostPerHour)}</p>
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-500/70 mt-1.5">{t('dashboard.notes.allocatePlan', 'Allocated over planned hours')}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-colors">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">{t('dashboard.costAnalysis.netRate', 'Net Hourly Rate')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(netHourlyRate)}</p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 mt-1.5">{t('dashboard.notes.unitMinusLicense', 'Unit rate - license/hour')}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-colors">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">{t('dashboard.costAnalysis.breakEven', 'Break-even Hours')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{Math.ceil(breakEvenHours).toLocaleString()} h</p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 mt-1.5">{t('dashboard.notes.breakEven', 'License cost ÷ unit rate')}</p>
            </div>
          </div>
          </Card>
        </motion.div>

        {/* Charts */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-md font-bold text-slate-700 dark:text-slate-200 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                {t('dashboard.chart.monthly', '月次売上：計画 vs 実績')}
              </h3>
              <div className="flex gap-2">
                <button
                  data-html2canvas-ignore="true"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
                  title={t('dashboard.colors.chartTitle', 'Customize chart colors')}
                >
                  <Palette className="w-4 h-4" />
                  {t('dashboard.colors.button', 'Colors')}
                </button>
                <ChartExportMenu
                  chartId="dashboard-monthly-chart"
                  filenameRequest={`monthly_revenue_${currentYear}`}
                  data={stats}
                />
              </div>
            </div>
            {/* Color Picker Section */}
            {showColorPicker && (
              <div data-html2canvas-ignore="true" className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  チャートの色をカスタマイズ
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorField
                    label={`売上（${planShort}）`}
                    labelClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                    value={chartColors.planRevenue}
                    onChange={(planRevenue) => setChartColors({ ...chartColors, planRevenue })}
                  />
                  <ColorField
                    label={`売上（${actualShort}）`}
                    labelClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                    value={chartColors.actualRevenue}
                    onChange={(actualRevenue) => setChartColors({ ...chartColors, actualRevenue })}
                  />
                  <ColorField
                    label={t('dashboard.chart.accPlan', '累計（計画）')}
                    labelClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                    value={chartColors.accPlan}
                    onChange={(accPlan) => setChartColors({ ...chartColors, accPlan })}
                  />
                  <ColorField
                    label={t('dashboard.chart.accActual', '累計（実績）')}
                    labelClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                    value={chartColors.accActual}
                    onChange={(accActual) => setChartColors({ ...chartColors, accActual })}
                  />
                </div>
              </div>
            )}
            <div id="dashboard-monthly-chart" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={CHART_PALETTE.labelNeutral} tick={{ fill: CHART_PALETTE.labelNeutral, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} stroke={CHART_PALETTE.labelNeutral} tick={{ fill: CHART_PALETTE.labelNeutral, fontSize: 11 }} tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip
                    formatter={(val: number) => fmt(val)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', color: '#fff', borderRadius: '8px', border: `1px solid ${CHART_PALETTE.grid}` }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: CHART_PALETTE.labelNeutral }} />
                  <Bar dataKey="plannedRevenue" name={planShort} fill={chartColors.planRevenue} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="plannedRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.planRevenue} />
                  </Bar>
                  <Bar dataKey="actualRevenue" name={actualShort} fill={chartColors.actualRevenue} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="actualRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.actualRevenue} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-md font-bold text-slate-700 dark:text-slate-200 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-emerald-500 dark:text-emerald-400" />
                {t('dashboard.charts.cumulative', 'Cumulative Revenue (Plan vs Actual)')}
              </h3>
              <ChartExportMenu
                chartId="dashboard-cumulative-chart"
                filenameRequest={`cumulative_revenue_${currentYear}`}
                data={accumulatedStats}
              />
            </div>
            <div id="dashboard-cumulative-chart" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={accumulatedStats}>
                  <defs>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.accActual} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={chartColors.accActual} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} stroke={CHART_PALETTE.labelNeutral} tick={{ fill: CHART_PALETTE.labelNeutral, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} stroke={CHART_PALETTE.labelNeutral} tick={{ fill: CHART_PALETTE.labelNeutral, fontSize: 11 }} tickFormatter={(val) => `${(val / 10000).toFixed(1)}万`} />
                  <Tooltip
                    formatter={(val: number) => fmt(val)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', color: '#fff', borderRadius: '8px', border: `1px solid ${CHART_PALETTE.grid}` }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: CHART_PALETTE.labelNeutral }} />
                  <Area type="monotone" dataKey="accActualRevenue" name={t('dashboard.chart.accActual', actualShort)} stroke={chartColors.accActual} fillOpacity={1} fill="url(#colorAct)" strokeWidth={2}>
                    <LabelList dataKey="accActualRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.accActual} fontWeight="bold" offset={10} />
                  </Area>
                  <Line type="monotone" strokeDasharray="3 3" dataKey="accPlannedRevenue" name={t('dashboard.chart.accPlan', planShort)} stroke={chartColors.accPlan} strokeWidth={2} dot={false}>
                    <LabelList dataKey="accPlannedRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.accPlan} offset={-10} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Financial Summary */}
        <motion.div variants={itemVariants}>
          <Card
            id="section-financial-summary"
            gradient
            fromColor={dashboardColors.summaryFrom}
            toColor={dashboardColors.summaryTo}
            className="p-5 flex-shrink-0"
          >
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.gross', 'Gross (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmt(grossRevenueActual)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(grossRevenueActual)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.license', 'License Cost')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmt(licenseTotal)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(licenseTotal)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.net', 'Net (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{fmtSigned(netRevenueActual)}</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{toMan(netRevenueActual)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs font-semibold text-slate-200 uppercase">{t('dashboard.summary.margin', 'Margin (Actual)')}</p>
                <p className="text-2xl font-bold mt-1 text-white">{profitMarginActual.toFixed(1)}%</p>
                <p className="text-[11px] font-medium mt-1 text-slate-300">{t('dashboard.summary.netOverGross', 'Net / Gross')}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
