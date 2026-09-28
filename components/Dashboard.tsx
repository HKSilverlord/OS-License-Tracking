import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../utils/helpers';
import { ExportButton } from './ExportButton';
import { ChartColorButton } from './ChartColorButton';
import { YearControl, YearExportButton } from './YearControl';
import { useLanguage } from '../contexts/LanguageContext';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { formatVariance } from '../utils/variance';
import { useUserRole } from '../contexts/UserRoleContext';
import { computeYearlyCost, useCatiaStore } from '../stores/useCatiaStore';
import { CHART_PALETTE, useChartPref } from '../utils/chartColorPrefs';
import { buttonClasses } from './ui/Button';
import { Card, CardHeader, WithYear } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Field';
import { Meter, Metric } from './ui/Metric';
import { Page } from './ui/Page';
import { Skeleton } from './ui/Skeleton';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCatiaHydration } from '../hooks/useCatiaHydration';

export interface DashboardProps {
  /** Single source of truth for the year — owned by the App shell. */
  currentYear: number;
}

interface DashboardChartColors {
  planRevenue: string;
  actualRevenue: string;
  accPlan: string;
  accActual: string;
}

/** Chart series defaults come from the shared, theme-safe palette. */
const DEFAULT_CHART_COLORS: DashboardChartColors = {
  planRevenue: CHART_PALETTE.neutral,
  actualRevenue: CHART_PALETTE.plan,
  accPlan: CHART_PALETTE.neutral,
  accActual: CHART_PALETTE.actual,
};

const CHART_COLOR_KEYS = ['planRevenue', 'actualRevenue', 'accPlan', 'accActual'] as const;

/* ------------------------------------------------------------------ *
 * Stored-preference migration — the localStorage key is unchanged so
 * colours saved by the previous implementation keep working.
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

/** recharts 3 `LabelFormatter` receives `RenderableText`, which is not exported from the package root. */
type ChartLabelValue = string | number | boolean | null | undefined;

/** Bar/line data labels stay in 万 (10k JPY) units, as the slides they end up on use. */
const manLabel = (value: ChartLabelValue): string =>
  typeof value === 'number' && value > 0 ? (value / 10000).toFixed(0) : '';

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    color: '#fff',
    borderRadius: '10px',
    border: 'none',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
    fontSize: '12px',
  },
  itemStyle: { color: '#fff' },
  labelStyle: { color: '#fff', fontWeight: 600 },
} as const;

const AXIS_TICK = { fill: CHART_PALETTE.labelNeutral, fontSize: 11 };

/**
 * One shared setting: an input for an admin, the plain figure for everyone
 * else, with the same unit either way.
 */
const Assumption: React.FC<{
  label: string;
  hint?: string;
  value: number;
  display: string;
  prefix?: string;
  suffix?: string;
  editable: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, hint, value, display, prefix, suffix, editable, onChange }) => (
  <div className="min-w-0">
    <dt className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1.5">
      {editable ? (
        <div className="flex items-center gap-2">
          {prefix && <span className="shrink-0 text-[13px] text-slate-500 dark:text-slate-400">{prefix}</span>}
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            controlSize="sm"
            value={value}
            onChange={onChange}
            aria-label={label}
            className="min-w-0 text-right tabular-nums no-spinner"
          />
          {suffix && <span className="shrink-0 text-[13px] text-slate-500 dark:text-slate-400">{suffix}</span>}
        </div>
      ) : (
        <p className="flex h-8 items-center gap-1.5 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
          {prefix && <span className="text-[13px] font-normal text-slate-500 dark:text-slate-400">{prefix}</span>}
          {display}
          {suffix && <span className="text-[13px] font-normal text-slate-500 dark:text-slate-400">{suffix}</span>}
        </p>
      )}
      {hint && <p className="mt-1 text-xs leading-5 text-slate-400 dark:text-slate-500">{hint}</p>}
    </dd>
  </div>
);

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-5 sm:space-y-6" aria-hidden="true">
    <Card padding="lg">
      <Skeleton className="h-5 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </Card>
    <Card padding="lg">
      <Skeleton className="h-5 w-40" />
      <Skeleton.Table rows={3} cols={5} className="mt-5" />
    </Card>
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map(i => (
        <Card key={i} padding="lg" className="space-y-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-72 w-full" />
        </Card>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

export const Dashboard: React.FC<DashboardProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const { isAdmin } = useUserRole();

  const {
    loading,
    error,
    reload,
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
  } = useDashboardData(currentYear);

  const [chartColors, setChartColors] = useChartPref<DashboardChartColors>(
    'dashboard_chartColors', DEFAULT_CHART_COLORS, migrateChartColors,
  );

  // Select the computed NUMBER, never the stable `getYearlyCost` function —
  // selecting the function reference means the figure never re-renders on CATIA edits.
  const licenseTotal = useCatiaStore(s => computeYearlyCost(s.licenseCosts, currentYear));
  const catiaSyncStatus = useCatiaStore(s => s.syncStatus);

  useCatiaHydration();

  const { format: nf, formatDecimal: nfDecimal } = useNumberFormat();
  const manYen = t('catia.manYenUnit', '万');

  const header = {
    title: t('nav.dashboard', 'Dashboard'),
    description: t('dashboard.header.desc', 'Revenue, hours and license cost for the year'),
    actions: (
      <>
        <YearControl />
        <YearExportButton />
      </>
    ),
  };

  if (loading) {
    return (
      <Page {...header}>
        <div role="status" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
          <DashboardSkeleton />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('empty.loadFailedTitle', 'Could not load this year')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <button type="button" onClick={reload} className={buttonClasses('secondary')}>
                {t('buttons.retry', 'Try again')}
              </button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (rawRecords.length === 0) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t('empty.noDataTitle', 'No hours recorded for {year} yet').replace('{year}', String(currentYear))}
            description={t('empty.noDataHint', 'Enter planned and actual hours in Project tracking, or choose another year.')}
            actions={
              <Link to="/tracking" className={buttonClasses('secondary')}>
                {t('empty.goToTracking', 'Go to Project tracking')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </Card>
      </Page>
    );
  }

  const totalPlanHours = stats.reduce((acc, curr) => acc + curr.plannedHours, 0);
  const totalActualHours = stats.reduce((acc, curr) => acc + curr.actualHours, 0);

  // INVARIANT: the gross figures are the sum of the very same monthly buckets the
  // chart renders, so Σ monthly revenue === gross revenue exactly (same additions).
  const grossRevenuePlan = stats.reduce((acc, curr) => acc + curr.plannedRevenue, 0);
  const grossRevenueActual = stats.reduce((acc, curr) => acc + curr.actualRevenue, 0);

  const netRevenuePlan = grossRevenuePlan - licenseTotal;
  const netRevenueActual = grossRevenueActual - licenseTotal;
  const profitMarginActual = grossRevenueActual !== 0 ? (netRevenueActual / grossRevenueActual) * 100 : 0;
  const licenseCostPerHour = totalPlanHours !== 0 ? licenseTotal / totalPlanHours : 0;
  const netHourlyRate = unitPrice - licenseCostPerHour;
  const breakEvenHours = unitPrice !== 0 ? licenseTotal / unitPrice : 0;

  const toMan = (val: number) => `${nfDecimal(val / 10000)}${manYen}`;
  const fmt = (val: number) => formatCurrency(val);
  const fmtSigned = (val: number) => `${val < 0 ? '-' : ''}${formatCurrency(Math.abs(val))}`;
  const fmtHours = (val: number) => `${nf(Math.round(val))}h`;
  const fmtPercent = (fraction: number) => `${nfDecimal(fraction * 100)}%`;
  /** Actual over plan, or null where a ratio would mean nothing (no plan, or a plan at a loss). */
  const ratio = (actual: number, plan: number): number | null => (plan > 0 ? actual / plan : null);

  const planShort = t('tracker.planShort', 'Plan');
  const actualShort = t('tracker.actualShort', 'Actual');
  const currency = t('csv.unitCurrency', 'JPY');

  /** Translated headings for the chart CSVs, so Excel shows words, not field names. */
  const monthlyCsvColumns = [
    { key: 'month', label: t('csv.month', 'Month') },
    { key: 'name', label: t('csv.monthName', 'Month name') },
    { key: 'plannedHours', label: t('dashboard.kpi.planHoursLabel', 'Planned Hours') },
    { key: 'actualHours', label: t('dashboard.kpi.actualHoursLabel', 'Actual Hours') },
    { key: 'plannedRevenue', label: `${t('tracker.revenuePlan', 'Revenue (Plan)')} (${currency})` },
    { key: 'actualRevenue', label: `${t('tracker.revenueActual', 'Revenue (Actual)')} (${currency})` },
  ];

  const cumulativeCsvColumns = [
    { key: 'month', label: t('csv.month', 'Month') },
    { key: 'accPlannedRevenue', label: `${t('dashboard.chart.accPlan', 'Cumulative plan')} (${currency})` },
    { key: 'accActualRevenue', label: `${t('dashboard.chart.accActual', 'Cumulative actual')} (${currency})` },
  ];

  /* Plan vs actual, one row per measure. Variance is written the way this
     reader's language writes a shortfall — see utils/variance. */
  const comparison = [
    {
      key: 'hours',
      label: t('dashboard.planActual.hours', 'Hours'),
      plan: totalPlanHours,
      actual: totalActualHours,
      format: fmtHours,
      man: false,
    },
    {
      key: 'gross',
      label: t('dashboard.summary.gross', 'Gross revenue'),
      plan: grossRevenuePlan,
      actual: grossRevenueActual,
      format: fmt,
      man: true,
    },
    {
      key: 'net',
      label: t('dashboard.summary.net', 'Net revenue'),
      hint: t('dashboard.net.actual.subtitle', 'Gross revenue minus license cost'),
      plan: netRevenuePlan,
      actual: netRevenueActual,
      format: fmtSigned,
      man: true,
    },
  ].map(row => {
    const delta = row.actual - row.plan;
    return {
      ...row,
      delta,
      variance: formatVariance(delta, language, row.format),
      achievement: ratio(row.actual, row.plan),
    };
  });

  const comparisonCsv = comparison.map(row => ({
    measure: row.label,
    plan: Math.round(row.plan),
    actual: Math.round(row.actual),
    variance: Math.round(row.delta),
    achievement: row.achievement === null ? '' : Math.round(row.achievement * 1000) / 10,
  }));
  const comparisonCsvColumns = [
    { key: 'measure', label: t('dashboard.planActual.measure', 'Measure') },
    { key: 'plan', label: planShort },
    { key: 'actual', label: actualShort },
    { key: 'variance', label: t('dashboard.kpi.varianceLabel', 'Variance') },
    { key: 'achievement', label: `${t('dashboard.kpi.achievementLabel', 'Achievement')} (%)` },
  ];

  const showsArrow = comparison.some(row => row.variance.arrow !== '');
  const arrowHint = t('variance.arrowHint', '▲ is above plan, ▼ is below plan');
  const varianceTone = (delta: number) =>
    delta < 0 ? 'text-rose-600 dark:text-rose-400' : delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500';

  const grossRatio = ratio(grossRevenueActual, grossRevenuePlan);
  const licenseNote =
    catiaSyncStatus === 'loading' ? (
      t('dashboard.licenseSyncing', 'Syncing license data…')
    ) : catiaSyncStatus === 'error' ? (
      <span className="text-rose-600 dark:text-rose-400">{t('catia.syncError', 'Sync failed — showing local values')}</span>
    ) : (
      t('dashboard.summary.licenseNote', 'From the CATIA license table')
    );

  const resetColors = (keys: ReadonlyArray<keyof DashboardChartColors>) =>
    setChartColors(prev => {
      const next = { ...prev };
      for (const key of keys) next[key] = DEFAULT_CHART_COLORS[key];
      return next;
    });

  const colorRow = (key: keyof DashboardChartColors, label: string) => ({
    label,
    value: chartColors[key],
    onChange: (value: string) => setChartColors(prev => ({ ...prev, [key]: value })),
  });

  return (
    <Page {...header}>
      {/* The year at a glance: what came in, what the licenses cost, what is left. */}
      <Card id="section-financial-summary" padding="lg" className="animate-fade-up">
        <CardHeader
          title={<WithYear year={currentYear}>{t('dashboard.summary.title', 'Financial summary')}</WithYear>}
          description={t('dashboard.summary.desc', 'Actual revenue for the year, and what remains after the CATIA license cost')}
          actions={<ExportButton targetId="section-financial-summary" filename={`financial_summary_${currentYear}`} allowSvg={false} />}
        />
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-7 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <Metric
            size="lg"
            label={t('dashboard.summary.gross', 'Gross revenue')}
            value={fmt(grossRevenueActual)}
            sub={toMan(grossRevenueActual)}
            meter={grossRatio ?? undefined}
            meterLabel={grossRatio !== null ? t('dashboard.percentOfPlan', '{percent} of plan').replace('{percent}', fmtPercent(grossRatio)) : undefined}
            footnote={
              grossRatio !== null
                ? t('dashboard.summary.ofPlan', '{percent} of the {plan} plan')
                    .replace('{percent}', fmtPercent(grossRatio))
                    .replace('{plan}', fmt(grossRevenuePlan))
                : undefined
            }
          />
          <Metric
            size="lg"
            label={t('dashboard.summary.license', 'License cost')}
            value={fmt(licenseTotal)}
            sub={toMan(licenseTotal)}
            footnote={licenseNote}
          />
          <Metric
            size="lg"
            label={t('dashboard.summary.net', 'Net revenue')}
            value={fmtSigned(netRevenueActual)}
            tone={netRevenueActual < 0 ? 'negative' : 'default'}
            sub={toMan(netRevenueActual)}
            footnote={t('dashboard.net.actual.subtitle', 'Gross revenue minus license cost')}
          />
          <Metric
            size="lg"
            label={t('dashboard.summary.margin', 'Net margin')}
            value={`${nfDecimal(profitMarginActual)}%`}
            tone={profitMarginActual < 0 ? 'negative' : 'default'}
            sub={t('dashboard.summary.netOverGross', 'Net ÷ gross')}
          />
        </div>
      </Card>

      {/* Plan against actual for the three measures that matter. */}
      <Card id="section-kpi-summary" padding="lg" className="animate-fade-up [animation-delay:40ms]">
        <CardHeader
          title={<WithYear year={currentYear}>{t('dashboard.planActual.title', 'Plan vs actual')}</WithYear>}
          description={t('dashboard.planActual.desc', 'Where the year stands against its plan')}
          actions={
            <ExportButton
              targetId="section-kpi-summary"
              filename={`plan_vs_actual_${currentYear}`}
              allowSvg={false}
              data={comparisonCsv}
              csvColumns={comparisonCsvColumns}
            />
          }
        />

        {/* Desktop: a table, read across. */}
        <table className="mt-5 hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="w-[22%] py-2.5 pr-4 font-medium"><span className="sr-only">{t('dashboard.planActual.measure', 'Measure')}</span></th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">{planShort}</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">{actualShort}</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">{t('dashboard.kpi.varianceLabel', 'Variance')}</th>
              <th scope="col" className="w-[22%] py-2.5 text-right font-medium">{t('dashboard.kpi.achievementLabel', 'Achievement')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {comparison.map(row => (
              <tr key={row.key}>
                <th scope="row" className="py-3.5 pr-4 text-left align-top font-medium text-slate-900 dark:text-white">
                  {row.label}
                  {row.hint && <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">{row.hint}</span>}
                </th>
                <td className="py-3.5 pr-4 text-right align-top tabular-nums text-slate-600 dark:text-slate-300">
                  {row.format(row.plan)}
                  {row.man && <span className="block text-xs text-slate-400 dark:text-slate-500">{toMan(row.plan)}</span>}
                </td>
                <td className="py-3.5 pr-4 text-right align-top font-semibold tabular-nums text-slate-900 dark:text-white">
                  {row.format(row.actual)}
                  {row.man && <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">{toMan(row.actual)}</span>}
                </td>
                <td className={`py-3.5 pr-4 text-right align-top font-medium tabular-nums ${varianceTone(row.delta)}`}>
                  {row.variance.arrow && <span className="mr-0.5" title={arrowHint}>{row.variance.arrow}</span>}
                  {row.variance.text}
                </td>
                <td className="py-3.5 align-top">
                  {row.achievement === null ? (
                    <span className="block text-right text-slate-400">—</span>
                  ) : (
                    <div className="ml-auto flex max-w-[11rem] items-center gap-3">
                      <Meter value={row.achievement} className="flex-1" />
                      <span className="w-14 shrink-0 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                        {fmtPercent(row.achievement)}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Phone: one block per measure, read down. */}
        <div className="mt-4 divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
          {comparison.map(row => (
            <div key={row.key} className="py-4 first:pt-1 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-slate-900 dark:text-white">{row.label}</p>
                <p className={`text-sm font-medium tabular-nums ${varianceTone(row.delta)}`}>
                  {row.variance.arrow && <span className="mr-0.5" title={arrowHint}>{row.variance.arrow}</span>}
                  {row.variance.text}
                </p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{planShort}</dt>
                  <dd className="tabular-nums text-slate-600 dark:text-slate-300">{row.format(row.plan)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{actualShort}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{row.format(row.actual)}</dd>
                </div>
              </dl>
              {row.achievement !== null && (
                <div className="mt-3 flex items-center gap-3">
                  <Meter value={row.achievement} label={t('dashboard.kpi.achievementLabel', 'Achievement')} className="flex-1" />
                  <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">{fmtPercent(row.achievement)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {showsArrow && <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">{arrowHint}</p>}
      </Card>

      {/* Charts. Each card is its own export, title and year included. */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <Card id="dashboard-monthly-chart" padding="lg" className="animate-fade-up [animation-delay:80ms]">
          <CardHeader
            title={<WithYear year={currentYear}>{t('dashboard.chart.monthly', 'Monthly revenue')}</WithYear>}
            description={t('dashboard.chart.monthlyDesc', 'Plan and actual revenue each month')}
            actions={
              <>
                <ChartColorButton
                  rows={[
                    colorRow('planRevenue', planShort),
                    colorRow('actualRevenue', actualShort),
                  ]}
                  onReset={() => resetColors(['planRevenue', 'actualRevenue'])}
                />
                <ExportButton
                  targetId="dashboard-monthly-chart"
                  filename={`monthly_revenue_${currentYear}`}
                  data={stats}
                  csvColumns={monthlyCsvColumns}
                />
              </>
            }
          />
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={(val: number) => `${nf(Math.round(val / 10000))}${manYen}`} />
                <Tooltip formatter={(val: number) => fmt(val)} cursor={{ fill: 'rgba(148,163,184,0.12)' }} {...TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: CHART_PALETTE.labelNeutral }} />
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

        <Card id="dashboard-cumulative-chart" padding="lg" className="animate-fade-up [animation-delay:120ms]">
          <CardHeader
            title={<WithYear year={currentYear}>{t('dashboard.charts.cumulative', 'Cumulative revenue')}</WithYear>}
            description={t('dashboard.chart.cumulativeDesc', 'Running total against the plan')}
            actions={
              <>
                <ChartColorButton
                  rows={[
                    colorRow('accPlan', t('dashboard.chart.accPlan', 'Cumulative plan')),
                    colorRow('accActual', t('dashboard.chart.accActual', 'Cumulative actual')),
                  ]}
                  onReset={() => resetColors(['accPlan', 'accActual'])}
                />
                <ExportButton
                  targetId="dashboard-cumulative-chart"
                  filename={`cumulative_revenue_${currentYear}`}
                  data={accumulatedStats}
                  csvColumns={cumulativeCsvColumns}
                />
              </>
            }
          />
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={accumulatedStats} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardAccActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.accActual} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={chartColors.accActual} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_PALETTE.grid} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={(val: number) => `${nf(Math.round(val / 10000))}${manYen}`} />
                <Tooltip formatter={(val: number) => fmt(val)} {...TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: CHART_PALETTE.labelNeutral }} />
                <Area
                  type="monotone"
                  dataKey="accActualRevenue"
                  name={t('dashboard.chart.accActual', 'Cumulative actual')}
                  stroke={chartColors.accActual}
                  fill="url(#dashboardAccActual)"
                  fillOpacity={1}
                  strokeWidth={2}
                >
                  <LabelList dataKey="accActualRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.accActual} fontWeight="bold" offset={10} />
                </Area>
                <Line
                  type="monotone"
                  strokeDasharray="4 4"
                  dataKey="accPlannedRevenue"
                  name={t('dashboard.chart.accPlan', 'Cumulative plan')}
                  stroke={chartColors.accPlan}
                  strokeWidth={2}
                  dot={false}
                >
                  <LabelList dataKey="accPlannedRevenue" position="top" formatter={manLabel} fontSize={10} fill={chartColors.accPlan} offset={-10} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* What the licenses cost per hour of work, and the settings behind it. */}
      <Card id="section-cost-analysis" padding="lg" className="animate-fade-up [animation-delay:160ms]">
        <CardHeader
          title={<WithYear year={currentYear}>{t('dashboard.costAnalysis.title', 'Cost analysis')}</WithYear>}
          description={t('dashboard.costAnalysis.subtitle', 'What the license cost means for each hour of work')}
          actions={
            <>
              <Link
                to="/catia-license"
                data-html2canvas-ignore="true"
                className={buttonClasses('ghost', 'sm', 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300')}
              >
                {t('nav.catiaLicense', 'CATIA licenses')}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <ExportButton targetId="section-cost-analysis" filename={`cost_analysis_${currentYear}`} allowSvg={false} />
            </>
          }
        />
        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <Metric
            label={t('dashboard.costAnalysis.licensePerHour', 'License cost per hour')}
            value={fmt(licenseCostPerHour)}
            footnote={t('dashboard.notes.allocatePlan', 'License cost spread over the planned hours')}
          />
          <Metric
            label={t('dashboard.costAnalysis.netRate', 'Net hourly rate')}
            value={fmtSigned(netHourlyRate)}
            tone={netHourlyRate < 0 ? 'negative' : 'default'}
            footnote={t('dashboard.notes.unitMinusLicense', 'Hourly rate minus license cost per hour')}
          />
          <Metric
            label={t('dashboard.costAnalysis.breakEven', 'Break-even hours')}
            value={fmtHours(Math.ceil(breakEvenHours))}
            footnote={t('dashboard.notes.breakEven', 'Hours needed to cover the license cost')}
          />
        </div>

        <div className="mt-7 border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">
            {t('dashboard.assumptions.title', 'Settings')}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {isAdmin
              ? t('dashboard.assumptions.descAdmin', 'Shared with everyone. Changes save as you type.')
              : t('dashboard.assumptions.descViewer', 'Set by an administrator.')}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <Assumption
              label={t('dashboard.fx.hourly', 'Hourly rate')}
              hint={t('dashboard.assumptions.rateHint', 'Sets the net hourly rate and break-even')}
              value={unitPrice}
              display={nf(unitPrice)}
              suffix={t('unit.yenPerHour', 'JPY/h')}
              editable={isAdmin}
              onChange={handleUnitPriceChange}
            />
            <Assumption
              label={t('dashboard.license.count', 'License seats')}
              hint={t('dashboard.assumptions.seatsHint', 'Also sets the capacity line in Monthly plan vs actual')}
              value={licenseComputers}
              display={nf(licenseComputers)}
              suffix={t('dashboard.license.units', 'seats')}
              editable={isAdmin}
              onChange={handleLicenseComputersChange}
            />
            <Assumption
              label={t('dashboard.license.perSeat', 'Fee per seat')}
              value={licensePerComputer}
              display={nf(licensePerComputer)}
              suffix={currency}
              editable={isAdmin}
              onChange={handleLicensePerComputerChange}
            />
            <Assumption
              label={t('dashboard.fx.label', 'Exchange rate')}
              value={exchangeRate}
              display={nf(exchangeRate)}
              prefix="1 JPY ="
              suffix="VND"
              editable={isAdmin}
              onChange={handleRateChange}
            />
          </dl>
        </div>
      </Card>
    </Page>
  );
};

export default Dashboard;
