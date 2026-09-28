import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipContentProps, LabelList } from 'recharts';
import { ChartColorButton } from './ChartColorButton';
import { ExportButton } from './ExportButton';
import { buttonClasses } from './ui/buttonClasses';
import { Card, CardHeader } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Page } from './ui/Page';
import { RefreshBar } from './ui/RefreshBar';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { useIsDarkTheme } from '../hooks/useDarkMode';
import { dbService } from '../services/dbService';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { chartTheme } from '../utils/chartTheme';
import { createLogger } from '../utils/logger';

const log = createLogger('LongTermPlanView');

/** The years the plan covers. */
const START_YEAR = 2024;
const END_YEAR = 2030;

interface LongTermPlanData {
  year: number;
  salesPlan: number | null;        // 売上計画（万円）
  salesActual: number | null;      // 売上実績（万円）
  hourlyRatePlan: number | null;   // 平均時給計画（円/時）
  hourlyRateActual: number | null; // 平均時給実績（円/時）
}

/** Row shape handed to Recharts (nulls become undefined so the lines break instead of dropping to 0). */
interface LongTermChartRow {
  year: string;
  salesPlan?: number;
  salesActual?: number;
  hourlyRatePlan?: number;
  hourlyRateActual?: number;
}

interface ChartColors {
  salesPlan: string;
  salesActual: string;
  hourlyRatePlan: string;
  hourlyRateActual: string;
}

type SeriesKey = keyof ChartColors;

const SERIES_KEYS: readonly SeriesKey[] = ['salesPlan', 'salesActual', 'hourlyRatePlan', 'hourlyRateActual'];

/** Sales are columns on the left axis; the hourly rates are lines on the right. */
const SERIES_SHAPE: Record<SeriesKey, 'bar' | 'line'> = {
  salesPlan: 'bar',
  salesActual: 'bar',
  hourlyRatePlan: 'line',
  hourlyRateActual: 'line',
};

/** Theme-safe mid-tones, legible on both bg-white and bg-slate-900. */
const DEFAULT_CHART_COLORS: ChartColors = {
  salesPlan: CHART_PALETTE.neutral,
  salesActual: CHART_PALETTE.plan,
  hourlyRatePlan: CHART_PALETTE.actual2,
  hourlyRateActual: CHART_PALETTE.actual,
};

const isColorString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Merges a previously stored preference over the defaults, dropping anything unusable. */
const migrateChartColors = (raw: unknown): ChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const saved = raw as Partial<Record<SeriesKey, unknown>>;
  return {
    salesPlan: isColorString(saved.salesPlan) ? saved.salesPlan : DEFAULT_CHART_COLORS.salesPlan,
    salesActual: isColorString(saved.salesActual) ? saved.salesActual : DEFAULT_CHART_COLORS.salesActual,
    hourlyRatePlan: isColorString(saved.hourlyRatePlan) ? saved.hourlyRatePlan : DEFAULT_CHART_COLORS.hourlyRatePlan,
    hourlyRateActual: isColorString(saved.hourlyRateActual) ? saved.hourlyRateActual : DEFAULT_CHART_COLORS.hourlyRateActual,
  };
};

/** recharts 3 `LabelFormatter`: the label is a RenderableText, not necessarily a number. */
const makeFormatLabel = (nf: (value: number) => string) =>
  (value: string | number | boolean | null | undefined): string =>
    typeof value === 'number' ? nf(value) : String(value ?? '');

/**
 * An axis top a little above the largest value, on a round step, with the
 * ticks to match. The axes used to be fixed at 8,000 and 4,000, so a year
 * above either was cut off at the top of the plot.
 */
const niceAxis = (values: number[], fallback: number): { max: number; ticks: number[] } => {
  const largest = Math.max(0, ...values);
  if (largest === 0) {
    const step = fallback / 8;
    return { max: fallback, ticks: Array.from({ length: 9 }, (_, i) => i * step) };
  }
  const rough = (largest * 1.15) / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(s => s >= rough) ?? 10 * magnitude;
  const max = Math.ceil((largest * 1.15) / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) ticks.push(Math.round(value));
  return { max, ticks };
};

const Swatch = ({ color, shape }: { color: string; shape: 'bar' | 'line' }) =>
  shape === 'bar'
    ? <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
    : <span aria-hidden="true" className="w-4 shrink-0" style={{ borderTop: `2px solid ${color}` }} />;

/**
 * A rate line's value, on the side of its point away from the other rate line.
 * The two averages usually sit a few hundred yen apart, so with both labels
 * above their points one was printed over the other's marker.
 */
const RateLabel = ({ x = 0, y = 0, value, index = 0, other, color, bold = false, nf }: {
  x?: number | string;
  y?: number | string;
  value?: unknown;
  index?: number;
  other: (number | undefined)[];
  /** Not `fill`: Recharts overwrites that prop when it clones the label. */
  color: string;
  bold?: boolean;
  nf: (value: number) => string;
}) => {
  if (typeof value !== 'number') return null;
  const theirs = other[index];
  // On a tie the plan goes below, so the actual keeps the more visible spot.
  const below = theirs !== undefined && (theirs > value || (theirs === value && !bold));
  return (
    <text
      x={Number(x)}
      y={Number(y) + (below ? 18 : -10)}
      textAnchor="middle"
      fontSize={bold ? 11 : 10}
      fontWeight={bold ? 'bold' : undefined}
      fill={color}
    >
      {nf(value)}
    </text>
  );
};

/**
 * Hover card. Module scope on purpose: declared inside the view it would be a
 * new component type on every render and React would remount it. Recharts fills
 * in `active` / `payload` when it clones the element, so they are optional here.
 */
const HoverCard = ({ active, payload, chartColors, labels, units, nf }: Partial<TooltipContentProps<number, string>> & {
  chartColors: ChartColors;
  labels: Record<SeriesKey, string>;
  units: Record<SeriesKey, string>;
  nf: (value: number) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as LongTermChartRow | undefined;
  if (!data) return null;

  const row = (key: SeriesKey) => {
    const value = data[key];
    if (value === undefined) return null;
    return (
      <div key={key} className="flex items-center justify-between gap-6">
        <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
          <Swatch color={chartColors[key]} shape={SERIES_SHAPE[key]} />
          {labels[key]}
        </span>
        <span className="whitespace-nowrap font-medium tabular-nums text-slate-900 dark:text-slate-100">
          {nf(value)} <span className="font-normal text-slate-500 dark:text-slate-400">{units[key]}</span>
        </span>
      </div>
    );
  };
  const hasRates = data.hourlyRatePlan !== undefined || data.hourlyRateActual !== undefined;

  return (
    <div className="min-w-[240px] rounded-xl bg-white p-3 text-[13px] shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10">
      <p className="mb-2 font-semibold tabular-nums text-slate-900 dark:text-white">{data.year}</p>
      <div className="space-y-1">
        {row('salesPlan')}
        {row('salesActual')}
      </div>
      {hasRates && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          {row('hourlyRatePlan')}
          {row('hourlyRateActual')}
        </div>
      )}
    </div>
  );
};

export const LongTermPlanView: React.FC = () => {
  const { t } = useLanguage();
  const { format: nf } = useNumberFormat();
  const formatLabel = useMemo(() => makeFormatLabel(nf), [nf]);
  const toast = useToast();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => chartTheme(isDark), [isDark]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const loadedOnceRef = useRef(false);
  const loadSeqRef = useRef(0);
  const [longTermData, setLongTermData] = useState<LongTermPlanData[]>([]);

  // The localStorage key is unchanged, so earlier picks survive.
  const [chartColors, setChartColors, resetChartColors] = useChartPref<ChartColors>(
    'longTermPlan_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  // `t` is read through a ref: a language switch must not refetch seven years of aggregates.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /** `silent` keeps the chart on screen while the request runs. */
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++loadSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const data = await dbService.getYearlyAggregatedData(START_YEAR, END_YEAR);
      if (seq !== loadSeqRef.current) return;
      setLongTermData(data);
      setLoadError(false);
      loadedOnceRef.current = true;
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load long-term plan data:', error);
      setLoadError(true);
      if (!options?.silent) toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Hours saved in another view change this year's column.
    const handleDataUpdated = () => { void fetchData({ silent: true }); };
    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  const salesUnit = t('longTermPlan.unit.sales', '10k JPY');
  const rateUnit = t('longTermPlan.unit.hourlyRate', 'JPY/h');

  const labels: Record<SeriesKey, string> = {
    salesPlan: t('longTermPlan.salesPlan', 'Sales plan'),
    salesActual: t('longTermPlan.salesActual', 'Sales actual'),
    hourlyRatePlan: t('longTermPlan.hourlyRatePlan', 'Avg. hourly rate, plan'),
    hourlyRateActual: t('longTermPlan.hourlyRateActual', 'Avg. hourly rate, actual'),
  };
  const units: Record<SeriesKey, string> = {
    salesPlan: salesUnit,
    salesActual: salesUnit,
    hourlyRatePlan: rateUnit,
    hourlyRateActual: rateUnit,
  };

  /** Translated headings, with the unit each column is actually in. */
  const csvColumns = [
    { key: 'year', label: t('longTermPlan.year', 'Year') },
    ...SERIES_KEYS.map(key => ({ key, label: `${labels[key]} (${units[key]})` })),
  ];

  const chartData = useMemo<LongTermChartRow[]>(() => longTermData.map(d => ({
    year: d.year.toString(),
    salesPlan: d.salesPlan ?? undefined,
    salesActual: d.salesActual ?? undefined,
    hourlyRatePlan: d.hourlyRatePlan ?? undefined,
    hourlyRateActual: d.hourlyRateActual ?? undefined,
  })), [longTermData]);

  const planRates = useMemo(() => chartData.map(d => d.hourlyRatePlan), [chartData]);
  const actualRates = useMemo(() => chartData.map(d => d.hourlyRateActual), [chartData]);

  const salesAxis = useMemo(
    () => niceAxis(chartData.flatMap(d => [d.salesPlan ?? 0, d.salesActual ?? 0]), 8000),
    [chartData]
  );
  const rateAxis = useMemo(
    () => niceAxis(chartData.flatMap(d => [d.hourlyRatePlan ?? 0, d.hourlyRateActual ?? 0]), 4000),
    [chartData]
  );

  const hasData = longTermData.some(d => (d.salesPlan ?? 0) > 0 || (d.salesActual ?? 0) > 0);
  const range = `${START_YEAR}–${END_YEAR}`;

  const header = {
    title: t('nav.longTermPlan', 'Long-term plan'),
    description: t('longTermPlan.desc', 'Sales and the average hourly rate, year by year'),
  };

  if (loading && !loadedOnceRef.current) {
    return (
      <Page {...header}>
        <Card padding="lg" role="status" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
          <div aria-hidden="true">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            <Skeleton className="mt-6 h-[max(360px,calc(100dvh-17rem))] w-full" />
          </div>
        </Card>
      </Page>
    );
  }

  if (loadError && !loadedOnceRef.current) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('longTermPlan.loadFailedTitle', 'Could not load the long-term plan')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <button type="button" onClick={() => { void fetchData(); }} className={buttonClasses('secondary')}>
                {t('buttons.retry', 'Try again')}
              </button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (!hasData && !loading) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t('longTermPlan.emptyTitle', 'No sales for {range} yet').replace('{range}', range)}
            description={t('longTermPlan.emptyHint', 'Each year’s sales come from the hours recorded in Project tracking.')}
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

  return (
    <Page {...header}>
      {/* The card is the capture target: an exported image carries its title,
          range and key along with the plot. */}
      <Card id="long-term-plan-chart" padding="lg" className="animate-fade-up">
        <CardHeader
          title={
            <>
              {t('longTermPlan.title', 'OS business long-term plan')}{' '}
              <span className="whitespace-nowrap font-normal tabular-nums text-slate-500 dark:text-slate-400">{range}</span>
            </>
          }
          description={t('longTermPlan.chartDesc', 'Sales on the left axis, average hourly rate on the right')}
          actions={
            <>
              <ChartColorButton
                rows={SERIES_KEYS.map(key => ({
                  label: labels[key],
                  value: chartColors[key],
                  onChange: (value: string) => setChartColors(prev => ({ ...prev, [key]: value })),
                }))}
                onReset={resetChartColors}
              />
              <ExportButton
                targetId="long-term-plan-chart"
                filename="long_term_plan"
                data={chartData}
                csvColumns={csvColumns}
                disabled={loading}
              />
            </>
          }
        />

        {loading && <RefreshBar className="mt-4" />}

        <div className={`transition-opacity duration-200 ${loading ? 'opacity-40' : ''}`}>
          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
            {SERIES_KEYS.map(key => (
              <li key={key} className="flex items-center gap-2">
                <Swatch color={chartColors[key]} shape={SERIES_SHAPE[key]} />
                {labels[key]}
              </li>
            ))}
          </ul>

          <div className="-mx-2 mt-3 overflow-x-auto px-2 custom-scrollbar">
            <div className="h-[max(360px,calc(100dvh-20rem))] min-w-[560px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 24, right: 8, left: 8, bottom: 4 }} aria-label={`${t('longTermPlan.title', 'OS business long-term plan')} ${range}`}>
                  <CartesianGrid vertical={false} stroke={theme.grid} yAxisId="left" />

                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    tick={{ fontSize: 12, fontWeight: 600, fill: theme.text }}
                    tickMargin={8}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, salesAxis.max]}
                    ticks={salesAxis.ticks}
                    width={72}
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    tick={{ fontSize: 11, fill: theme.muted }}
                    tickFormatter={nf}
                    label={{
                      value: t('longTermPlan.axis.sales', 'Sales (10k JPY)'),
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12, fontWeight: 600, fill: chartColors.salesActual, textAnchor: 'middle' },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, rateAxis.max]}
                    ticks={rateAxis.ticks}
                    width={72}
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    tick={{ fontSize: 11, fill: theme.muted }}
                    tickFormatter={nf}
                    label={{
                      value: t('longTermPlan.axis.hourlyRate', 'Avg. hourly rate (JPY/h)'),
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: 12, fontWeight: 600, fill: chartColors.hourlyRateActual, textAnchor: 'middle' },
                    }}
                  />

                  <Tooltip
                    cursor={{ fill: theme.focus }}
                    content={<HoverCard chartColors={chartColors} labels={labels} units={units} nf={nf} />}
                  />

                  <Bar yAxisId="left" dataKey="salesPlan" name={labels.salesPlan} fill={chartColors.salesPlan} radius={[4, 4, 0, 0]} maxBarSize={60}>
                    <LabelList dataKey="salesPlan" position="top" formatter={formatLabel} fontSize={10} fill={chartColors.salesPlan} />
                  </Bar>
                  <Bar yAxisId="left" dataKey="salesActual" name={labels.salesActual} fill={chartColors.salesActual} radius={[4, 4, 0, 0]} maxBarSize={60}>
                    <LabelList dataKey="salesActual" position="top" formatter={formatLabel} fontSize={11} fill={chartColors.salesActual} fontWeight="bold" />
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hourlyRatePlan"
                    name={labels.hourlyRatePlan}
                    stroke={chartColors.hourlyRatePlan}
                    strokeWidth={3}
                    dot={{ fill: chartColors.hourlyRatePlan, r: 5 }}
                    connectNulls={false}
                  >
                    <LabelList dataKey="hourlyRatePlan" content={<RateLabel other={actualRates} color={chartColors.hourlyRatePlan} nf={nf} />} />
                  </Line>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hourlyRateActual"
                    name={labels.hourlyRateActual}
                    stroke={chartColors.hourlyRateActual}
                    strokeWidth={3}
                    dot={{ fill: chartColors.hourlyRateActual, r: 5 }}
                    connectNulls={false}
                  >
                    <LabelList dataKey="hourlyRateActual" content={<RateLabel other={planRates} color={chartColors.hourlyRateActual} bold nf={nf} />} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  );
};
