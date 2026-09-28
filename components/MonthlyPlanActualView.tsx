import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, X } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipContentProps, LabelList, ReferenceLine, ReferenceArea } from 'recharts';
import { ExportButton } from './ExportButton';
import { CurrentMonthBadge } from './CurrentMonthBadge';
import { SeriesStyleButton, SeriesStyleCheck, type SeriesStyle } from './SeriesStyleButton';
import { YearControl, YearExportButton } from './YearControl';
import { Button } from './ui/Button';
import { buttonClasses } from './ui/buttonClasses';
import { Card, CardHeader, WithYear } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Select } from './ui/Field';
import { Page } from './ui/Page';
import { RefreshBar } from './ui/RefreshBar';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslateFn } from '../contexts/LanguageContext';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { useIsDarkTheme } from '../hooks/useDarkMode';
import { useMonthKeys } from '../hooks/useMonthKeys';
import { useMonthlyPlanActualData } from '../hooks/useMonthlyPlanActualData';
import type { MonthlyPlanActualData } from '../hooks/useMonthlyPlanActualData';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { chartTheme, type ChartTheme } from '../utils/chartTheme';

interface MonthlyChartColors {
  capacityLine: SeriesStyle;
  workingHoursPlan: SeriesStyle;
  salesPlan: SeriesStyle;
  salesActual: SeriesStyle;
  workingHoursActual: SeriesStyle;
}

type SeriesKey = keyof MonthlyChartColors;

/**
 * The report's own colours, kept because this chart is pasted into the monthly
 * report next to earlier months; every one of them can be changed.
 */
const DEFAULT_CHART_COLORS: MonthlyChartColors = {
  capacityLine: { color: CHART_PALETTE.neutral, opacity: 1, labelColor: CHART_PALETTE.neutral, fontSize: 10, bold: false, stroke: false },
  workingHoursPlan: { color: '#FFB3B3', opacity: 1, labelColor: CHART_PALETTE.plan, fontSize: 10, bold: true, stroke: false, barSize: 60 },
  salesPlan: { color: '#00BFFF', opacity: 1, labelColor: CHART_PALETTE.actual, fontSize: 10, bold: false, stroke: false },
  salesActual: { color: CHART_PALETTE.plan2, opacity: 1, labelColor: CHART_PALETTE.plan2, fontSize: 11, bold: true, stroke: true, barSize: 40 },
  workingHoursActual: { color: '#CC0000', opacity: 1, labelColor: '#ffffff', fontSize: 10, bold: true, stroke: false, barSize: 30 },
};

/** In the order the legend and the style panel list them: sales first, then hours. */
const SERIES_KEYS: readonly SeriesKey[] = ['salesPlan', 'salesActual', 'workingHoursPlan', 'workingHoursActual', 'capacityLine'];

/** How each series is drawn, for its legend swatch. */
const SERIES_SHAPE: Record<SeriesKey, 'line' | 'dash' | 'bar'> = {
  salesPlan: 'line',
  salesActual: 'bar',
  workingHoursPlan: 'bar',
  workingHoursActual: 'bar',
  capacityLine: 'dash',
};

/**
 * Migration for the stored `monthly_chartColors` preference:
 *  - the oldest format stored a bare colour string per series,
 *  - later formats stored a partial SeriesStyle, merged over the defaults so fields added
 *    since the preference was written are picked up.
 */
const migrateChartColors = (raw: unknown): MonthlyChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const parsed = raw as Partial<Record<SeriesKey, unknown>>;

  const mergeSeries = (key: SeriesKey): SeriesStyle => {
    const value = parsed[key];
    if (typeof value === 'string') return { ...DEFAULT_CHART_COLORS[key], color: value };
    if (value !== null && typeof value === 'object') {
      return { ...DEFAULT_CHART_COLORS[key], ...(value as Partial<SeriesStyle>) };
    }
    return DEFAULT_CHART_COLORS[key];
  };

  return {
    capacityLine: mergeSeries('capacityLine'),
    workingHoursPlan: mergeSeries('workingHoursPlan'),
    salesPlan: mergeSeries('salesPlan'),
    salesActual: mergeSeries('salesActual'),
    workingHoursActual: mergeSeries('workingHoursActual'),
  };
};

interface MonthlyPlanActualViewProps {
  currentYear: number;
}

/* --------------------------------------------------------------------------
 * Chart renderers
 *
 * Module scope on purpose: a component declared inside the view is a new type
 * on every render, so React discards the subtree — the selected card and the
 * bar animations reset. Recharts injects x/y/value/payload into the element
 * given to content= / shape=, so view state is threaded in as explicit props.
 * ------------------------------------------------------------------------ */

const Swatch = ({ style, shape }: { style: SeriesStyle; shape: 'line' | 'dash' | 'bar' }) =>
  shape === 'bar' ? (
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: style.color, opacity: style.opacity }} />
  ) : (
    <span
      aria-hidden="true"
      className="w-4 shrink-0"
      style={{ borderTop: `2px ${shape === 'dash' ? 'dashed' : 'solid'} ${style.color}`, opacity: style.opacity }}
    />
  );

/** The month's figures: on hover, and held on a selected month. */
const MonthDetailCard = ({ data, chartColors, labels, nf, hoursUnit, salesUnit, t, onClose }: {
  data: MonthlyPlanActualData;
  chartColors: MonthlyChartColors;
  labels: Record<SeriesKey, string>;
  nf: (value: number) => string;
  hoursUnit: string;
  salesUnit: string;
  t: TranslateFn;
  /** Only passed when the month is selected: releases the card. */
  onClose?: () => void;
}) => {
  const row = (key: SeriesKey, unit: string) => (
    <div key={key} className="flex items-center justify-between gap-6">
      <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
        <Swatch style={chartColors[key]} shape={SERIES_SHAPE[key]} />
        {labels[key]}
      </span>
      <span className="whitespace-nowrap font-medium tabular-nums text-slate-900 dark:text-slate-100">
        {nf(data[key])} <span className="font-normal text-slate-400 dark:text-slate-500">{unit}</span>
      </span>
    </div>
  );

  return (
    <div className="min-w-[248px] rounded-xl bg-white p-3 text-[13px] shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-white">{data.monthLabel}</span>
        {onClose && (
          <button
            type="button"
            data-html2canvas-ignore="true"
            onClick={onClose}
            title={t('common.close', 'Close')}
            aria-label={t('common.close', 'Close')}
            className="pointer-events-auto -mr-1 grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        {row('salesPlan', salesUnit)}
        {row('salesActual', salesUnit)}
      </div>
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        {row('workingHoursPlan', hoursUnit)}
        {row('workingHoursActual', hoursUnit)}
        {row('capacityLine', hoursUnit)}
      </div>
    </div>
  );
};

/** Hover card; recharts 3 passes `TooltipContentProps`. */
const HoverCard = ({ active, payload, ...card }: Partial<TooltipContentProps<number, string>> & Omit<React.ComponentProps<typeof MonthDetailCard>, 'data' | 'onClose'>) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as MonthlyPlanActualData | undefined;
  if (!data) return null;
  return <MonthDetailCard data={data} {...card} />;
};

/** A zero actual is a real figure, not a missing one: say so above the empty bar. */
const ZeroLabel = ({ x = 0, y = 0, width = 0, value, index = 0, shownThrough, chartColors, theme }: {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
  index?: number;
  /** Months finished so far. A zero after them is a month not reached yet, not a month without sales. */
  shownThrough: number;
  chartColors: MonthlyChartColors;
  theme: ChartTheme;
}) => {
  if (value !== 0 || index >= shownThrough) return null;
  return (
    <g>
      <rect x={x + width / 2 - 8} y={y - 22} width={16} height={20} fill={theme.plate} rx={4} />
      <text x={x + width / 2} y={y - 8} fill={chartColors.salesActual.labelColor || CHART_PALETTE.labelNeutral} fontSize={14} fontWeight="bold" textAnchor="middle">0</text>
    </g>
  );
};

/** Value label on a soft plate, optionally outlined, in the series' own style. */
const ValueLabel = ({ x = 0, y = 0, value, width = 0, dataKey, chartColors, nf, theme, offset = 10, position = 'top', suffix = '' }: {
  x?: number;
  y?: number;
  value?: number | string;
  width?: number;
  dataKey: SeriesKey;
  chartColors: MonthlyChartColors;
  nf: (value: number) => string;
  theme: ChartTheme;
  offset?: number;
  position?: 'top' | 'insideTop' | 'left';
  suffix?: string;
}) => {
  if (value === 0 || !value) return null;

  const formatted = `${typeof value === 'number' && value > 1000 ? nf(value) : value}${suffix}`;
  const style = chartColors[dataKey];
  const color = style?.labelColor || CHART_PALETTE.labelNeutral;
  const fontSize = style?.fontSize || 10;
  const isBold = style?.bold !== false;

  let textX = x;
  let textY = y;
  if (position === 'insideTop') {
    textX = x + width / 2;
    textY = y + 15;
  } else if (position === 'top') {
    textX = x + width / 2;
    textY = y - offset;
  } else if (position === 'left') {
    textX = x - offset;
  }

  return (
    <g>
      <rect x={textX - 16} y={textY - 12} width={32} height={16} fill={theme.plate} rx={3} />
      {style?.stroke && (
        <text x={textX} y={textY} stroke={theme.halo} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" fontSize={fontSize} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
          {formatted}
        </text>
      )}
      <text x={textX} y={textY} fill={color} fontSize={fontSize} fontWeight={isBold ? 'bold' : 'normal'} textAnchor="middle" alignmentBaseline="middle">
        {formatted}
      </text>
    </g>
  );
};

/**
 * The actual hours, drawn inside the planned-hours column with a dashed line
 * up to where the plan ends, so the gap reads at a glance.
 *
 * The column centre is reported through a callback, not by taking the ref:
 * Recharts 3 keeps chart props in an immer-backed store that DEEP-FREEZES what
 * it is handed, so a ref passed as a prop arrives with a frozen `.current` and
 * the first write throws.
 */
const WorkingHoursActualBar = ({ fill, x = 0, y = 0, width = 0, height = 0, payload, chartColors, onColumnCoord }: {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: MonthlyPlanActualData;
  chartColors: MonthlyChartColors;
  onColumnCoord: (month: number, centerX: number) => void;
}) => {
  const planValue = payload?.workingHoursPlan || 0;
  const actualValue = payload?.workingHoursActual || 0;

  if (payload?.month) {
    onColumnCoord(payload.month, x + width / 2);
  }

  // Where the plan column's top is, on the same scale as this bar.
  const zeroY = y + height;
  const pixelsPerUnit = height / actualValue;
  const planY = zeroY - (planValue * pixelsPerUnit);

  return (
    <g>
      <path d={`M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`} stroke="none" fill={fill} fillOpacity={chartColors.workingHoursActual.opacity} />
      {planValue > 0 && actualValue > 0 && (
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={planY}
          stroke={chartColors.workingHoursActual.color}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
    </g>
  );
};

export const MonthlyPlanActualView: React.FC<MonthlyPlanActualViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const { format: nf } = useNumberFormat();
  const { loading, hasLoaded, error, reload, monthlyData, maxSales, maxWorkingHours } = useMonthlyPlanActualData(currentYear);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const columnCoordsRef = useRef<Record<number, number>>({});
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => chartTheme(isDark), [isDark]);

  const hoursUnit = t('monthlyPlanActual.unit.hours', 'h');
  const salesUnit = t('monthlyPlanActual.unit.sales', '10k JPY');

  const labels: Record<SeriesKey, string> = {
    salesPlan: t('monthlyPlanActual.legend.salesPlan', 'Sales plan'),
    salesActual: t('monthlyPlanActual.legend.salesActual', 'Sales actual'),
    workingHoursPlan: t('monthlyPlanActual.legend.workingPlan', 'Working hours plan'),
    workingHoursActual: t('monthlyPlanActual.legend.workingActual', 'Working hours actual'),
    capacityLine: t('monthlyPlanActual.legend.capacityLine', 'Capacity'),
  };

  /** Translated headings, with the unit each column is actually in. */
  const csvColumns = [
    { key: 'month', label: t('csv.month', 'Month') },
    { key: 'monthLabel', label: t('csv.monthName', 'Month name') },
    { key: 'capacityLine', label: `${labels.capacityLine} (${hoursUnit})` },
    { key: 'workingHoursPlan', label: `${labels.workingHoursPlan} (${hoursUnit})` },
    { key: 'workingHoursActual', label: `${labels.workingHoursActual} (${hoursUnit})` },
    { key: 'salesPlan', label: `${labels.salesPlan} (${salesUnit})` },
    { key: 'salesActual', label: `${labels.salesActual} (${salesUnit})` },
  ];

  // The localStorage key is unchanged, so earlier picks survive (see `migrateChartColors`).
  const [chartColors, setChartColors, resetChartColors] = useChartPref<MonthlyChartColors>(
    'monthly_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  const updateSeries = useCallback((key: string, patch: Partial<SeriesStyle>) => {
    if (!SERIES_KEYS.includes(key as SeriesKey)) return;
    setChartColors(prev => ({ ...prev, [key]: { ...prev[key as SeriesKey], ...patch } }));
  }, [setChartColors]);

  // See WorkingHoursActualBar: the ref cannot cross into Recharts, a callback can.
  const recordColumnCoord = useCallback((month: number, centerX: number) => {
    columnCoordsRef.current[month] = centerX;
  }, []);

  const unpin = useCallback(() => setPinnedMonth(null), []);
  useMonthKeys(pinnedMonth !== null, setPinnedMonth, unpin);

  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const thisYear = new Date().getFullYear();
  const finishedMonths = currentYear < thisYear ? 12 : currentYear > thisYear ? 0 : new Date().getMonth();
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);
  // Off by default: twelve near-identical figures sat on top of the columns. The
  // month card and the exports carry them; this is for a slide that needs them.
  const [showCapacityValues, setShowCapacityValues] = useState(false);

  const hasData = monthlyData.some(d => d.workingHoursPlan || d.workingHoursActual || d.salesPlan || d.salesActual);

  const header = {
    title: t('nav.monthlyPlanActual', 'Monthly plan vs actual'),
    description: t('monthlyPlanActual.desc', 'Sales and working hours each month, against the plan and capacity'),
    actions: (
      <>
        <YearControl />
        <YearExportButton />
      </>
    ),
  };

  // Also while a retry after a failed first load is in flight.
  if (!hasLoaded && (loading || !error)) {
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

  // Any failed load, not only the first: the chart still on screen is another year's.
  if (error) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('empty.loadFailedTitle', 'Could not load this year')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <Button variant="secondary" onClick={reload} isLoading={loading}>
                {t('buttons.retry', 'Try again')}
              </Button>
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

  const cardProps = { chartColors, labels, nf, hoursUnit, salesUnit, t };
  const pinnedData = pinnedMonth !== null ? monthlyData.find(d => d.month === pinnedMonth) : undefined;
  const currentMonthLabel = currentMonth !== null ? monthlyData.find(d => d.month === currentMonth)?.monthLabel : undefined;

  return (
    <Page {...header}>
      {/* The card is the capture target: an exported image carries its title,
          year and key along with the plot. */}
      <Card id="monthly-plan-actual-chart" padding="lg" className="animate-fade-up">
        <CardHeader
          title={<WithYear year={currentYear}>{t('monthlyPlanActual.chartTitle', 'OS contract work: plan vs actual')}</WithYear>}
          description={t('monthlyPlanActual.chartDesc', 'Sales on the left axis, working hours on the right')}
          actions={
            <>
              <div data-html2canvas-ignore="true">
                <Select
                  controlSize="sm"
                  aria-label={t('chart.monthDetailsHint', 'Show the numbers for one month')}
                  title={t('chart.monthDetailsHint', 'Show the numbers for one month')}
                  value={pinnedMonth ?? ''}
                  onChange={event => setPinnedMonth(event.target.value ? Number(event.target.value) : null)}
                  className="w-36"
                >
                  <option value="">{t('chart.monthDetails', 'Month details')}</option>
                  {monthlyData.map(d => (
                    <option key={d.month} value={d.month}>{d.monthLabel}</option>
                  ))}
                </Select>
              </div>
              <SeriesStyleButton
                series={SERIES_KEYS.map(key => ({ key, label: labels[key], style: chartColors[key] }))}
                onChange={updateSeries}
                onReset={() => {
                  resetChartColors();
                  setShowCurrentMonth(true);
                  setShowCapacityValues(false);
                }}
                barSizeRange={[10, 100]}
                extra={
                  <>
                    {currentMonth !== null && (
                      <SeriesStyleCheck checked={showCurrentMonth} onChange={setShowCurrentMonth}>
                        {t('chart.highlightCurrentMonth', 'Mark this month')}
                      </SeriesStyleCheck>
                    )}
                    <SeriesStyleCheck checked={showCapacityValues} onChange={setShowCapacityValues}>
                      {t('chart.showCapacityValues', 'Show capacity figures')}
                    </SeriesStyleCheck>
                  </>
                }
              />
              <ExportButton
                targetId="monthly-plan-actual-chart"
                filename={`monthly_plan_actual_${currentYear}`}
                data={monthlyData}
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
                <Swatch style={chartColors[key]} shape={SERIES_SHAPE[key]} />
                {labels[key]}
              </li>
            ))}
          </ul>

          {/* Narrow screens scroll the plot sideways rather than squeezing
              twelve months of labelled columns into a phone's width. */}
          <div className="-mx-2 mt-3 overflow-x-auto px-2 custom-scrollbar">
            <div className="relative h-[max(360px,calc(100dvh-20rem))] min-w-[680px]">
              {pinnedData && (() => {
                // Beside its column, on whichever side has the room.
                const onLeft = pinnedData.month > 8;
                const columnX = columnCoordsRef.current[pinnedData.month] ?? 100;
                return (
                  <div
                    className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 transition-[left] duration-200 ease-out ${onLeft ? '-translate-x-full' : ''}`}
                    style={{ left: onLeft ? columnX - 24 : columnX + 24 }}
                  >
                    <MonthDetailCard data={pinnedData} {...cardProps} onClose={unpin} />
                  </div>
                );
              })()}

              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyData}
                  margin={{ top: 28, right: 16, left: 8, bottom: 4 }}
                  onClick={state => {
                    // recharts 3 `MouseHandlerDataParam` has no `activePayload` — recover the
                    // clicked datum from the active index instead.
                    const rawIndex = state?.activeIndex;
                    if (rawIndex === undefined || rawIndex === null) return;
                    const index = Number(rawIndex);
                    if (!Number.isInteger(index) || index < 0) return;
                    const clicked = monthlyData[index];
                    // Idempotent: the card's close button and Esc release it.
                    if (clicked) setPinnedMonth(clicked.month);
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid vertical={false} stroke={theme.grid} yAxisId="left" xAxisId="main" />

                  {showCurrentMonth && currentMonthLabel && (
                    <ReferenceArea yAxisId="left" xAxisId="main" x1={currentMonthLabel} x2={currentMonthLabel} fill="rgba(251,146,60,0.1)" />
                  )}
                  {showCurrentMonth && currentMonthLabel && (
                    <ReferenceLine
                      yAxisId="left"
                      xAxisId="main"
                      x={currentMonthLabel}
                      stroke={theme.marker}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={<CurrentMonthBadge label={t('chart.thisMonth', 'This month')} color={theme.marker} />}
                    />
                  )}

                  <XAxis
                    xAxisId="main"
                    dataKey="monthLabel"
                    interval={0}
                    tick={{ fontSize: 12, fontWeight: 600, fill: theme.text }}
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    height={28}
                    tickMargin={8}
                  />
                  {/* The actual-hours bars sit on their own axis so they can be
                      drawn inside the planned-hours columns. */}
                  <XAxis xAxisId="actualLayer" dataKey="monthLabel" hide interval={0} height={0} />

                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, maxSales]}
                    width={64}
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    tick={{ fontSize: 11, fill: theme.muted }}
                    tickFormatter={nf}
                    label={{
                      value: t('monthlyPlanActual.axis.sales', 'Sales (10k JPY)'),
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12, fontWeight: 600, fill: chartColors.salesActual.color, textAnchor: 'middle' },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, maxWorkingHours]}
                    width={64}
                    tickLine={false}
                    axisLine={{ stroke: theme.line }}
                    tick={{ fontSize: 11, fill: theme.muted }}
                    tickFormatter={nf}
                    label={{
                      value: t('monthlyPlanActual.axis.workingHours', 'Working hours per month'),
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: 12, fontWeight: 600, fill: chartColors.workingHoursActual.color, textAnchor: 'middle' },
                    }}
                  />

                  {/* One card at a time: hover shows one, a selected month holds its own. */}
                  <Tooltip
                    active={pinnedMonth !== null ? false : undefined}
                    cursor={{ fill: theme.focus }}
                    content={<HoverCard {...cardProps} />}
                  />

                  <Line
                    xAxisId="main"
                    yAxisId="right"
                    type="monotone"
                    dataKey="capacityLine"
                    name={labels.capacityLine}
                    stroke={chartColors.capacityLine.color}
                    strokeOpacity={chartColors.capacityLine.opacity}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  >
                    {showCapacityValues && (
                      <LabelList dataKey="capacityLine" position="left" content={<ValueLabel position="left" dataKey="capacityLine" chartColors={chartColors} nf={nf} theme={theme} suffix="h" />} />
                    )}
                  </Line>

                  <Bar
                    xAxisId="main"
                    yAxisId="right"
                    dataKey="workingHoursPlan"
                    name={labels.workingHoursPlan}
                    fill={chartColors.workingHoursPlan.color}
                    fillOpacity={chartColors.workingHoursPlan.opacity}
                    maxBarSize={chartColors.workingHoursPlan.barSize ?? 60}
                  >
                    <LabelList dataKey="workingHoursPlan" position="insideTop" content={<ValueLabel position="insideTop" dataKey="workingHoursPlan" chartColors={chartColors} nf={nf} theme={theme} />} />
                  </Bar>

                  <Line
                    xAxisId="main"
                    yAxisId="left"
                    type="monotone"
                    dataKey="salesPlan"
                    name={labels.salesPlan}
                    stroke={chartColors.salesPlan.color}
                    strokeOpacity={chartColors.salesPlan.opacity}
                    strokeWidth={3}
                    dot={{ fill: chartColors.salesPlan.color, r: 5 }}
                  >
                    <LabelList dataKey="salesPlan" position="top" content={<ValueLabel position="top" dataKey="salesPlan" chartColors={chartColors} nf={nf} theme={theme} />} />
                  </Line>

                  <Bar
                    xAxisId="main"
                    yAxisId="left"
                    dataKey="salesActual"
                    name={labels.salesActual}
                    fill={chartColors.salesActual.color}
                    fillOpacity={chartColors.salesActual.opacity}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={chartColors.salesActual.barSize ?? 40}
                  >
                    <LabelList dataKey="salesActual" position="top" content={<ValueLabel position="top" dataKey="salesActual" chartColors={chartColors} nf={nf} theme={theme} />} />
                    <LabelList content={<ZeroLabel shownThrough={finishedMonths} chartColors={chartColors} theme={theme} />} />
                  </Bar>

                  <Bar
                    xAxisId="actualLayer"
                    yAxisId="right"
                    dataKey="workingHoursActual"
                    name={labels.workingHoursActual}
                    fill={chartColors.workingHoursActual.color}
                    fillOpacity={chartColors.workingHoursActual.opacity}
                    maxBarSize={chartColors.workingHoursActual.barSize ?? 30}
                    shape={<WorkingHoursActualBar chartColors={chartColors} onColumnCoord={recordColumnCoord} />}
                  >
                    <LabelList dataKey="workingHoursActual" position="insideTop" content={<ValueLabel position="insideTop" dataKey="workingHoursActual" chartColors={chartColors} nf={nf} theme={theme} />} />
                  </Bar>

                  {/* Invisible spacer that keeps the actual layer's columns
                      lined up with the main layer's. */}
                  <Bar
                    xAxisId="actualLayer"
                    yAxisId="left"
                    dataKey="salesActual"
                    fill="transparent"
                    legendType="none"
                    tooltipType="none"
                    style={{ pointerEvents: 'none' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  );
};
