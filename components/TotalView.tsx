import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, X } from 'lucide-react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, ReferenceArea, ReferenceLine } from 'recharts';
import { MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { ExportButton } from './ExportButton';
import { CurrentMonthBadge } from './CurrentMonthBadge';
import { SeriesStyleButton, SeriesStyleCheck, type SeriesStyle } from './SeriesStyleButton';
import { YearControl, YearExportButton } from './YearControl';
import { Badge } from './ui/Badge';
import { buttonClasses } from './ui/buttonClasses';
import { Card, CardHeader, WithYear } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Select } from './ui/Field';
import { Page } from './ui/Page';
import { RefreshBar } from './ui/RefreshBar';
import { Skeleton } from './ui/Skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslateFn } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { formatVariance } from '../utils/variance';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { useIsDarkTheme } from '../hooks/useDarkMode';
import { useMonthKeys } from '../hooks/useMonthKeys';
import { chartTheme } from '../utils/chartTheme';
import { createLogger } from '../utils/logger';

const log = createLogger('TotalView');

interface TotalViewProps {
  currentYear: number;
}

/** The two series the chart draws: they are what the legend filters and the style panel edits. */
const PLOTTED_SERIES = ['accPlan', 'accActual'] as const;
type PlottedSeries = (typeof PLOTTED_SERIES)[number];

type ChartColors = Record<PlottedSeries, SeriesStyle>;

/** One point of the monthly chart. */
interface TotalChartRow {
  name: string;
  /** Unabbreviated month, for the card heading — "Tháng 9", not "thg 9". */
  fullName: string;
  month: number;
  /** After the current month: planned but not yet worked. */
  isFuture: boolean;
  plan: number;
  actual: number;
  accPlan: number;
  accActual: number;
}

/** Theme-safe mid-tones, legible on both bg-white and bg-slate-900. */
const DEFAULT_CHART_COLORS: ChartColors = {
  accPlan: { color: CHART_PALETTE.labelNeutral, opacity: 1, labelColor: CHART_PALETTE.labelNeutral, fontSize: 10, bold: false, stroke: false },
  accActual: { color: CHART_PALETTE.actual, opacity: 1, labelColor: CHART_PALETTE.actual, fontSize: 12, bold: true, stroke: true },
};

/** A forecast month is drawn as an outline at this opacity rather than solid. */
const FORECAST_OPACITY = 0.3;

/** Where a bar sits in chart coordinates, so the detail card can anchor to it. */
type ColumnBox = { x: number; y: number; width: number };

/** Gap between the anchor point and the card. */
const CARD_OFFSET_PX = 12;

/**
 * How long the bars take to grow in, and how long hovering is ignored for: any
 * re-render hands Recharts a fresh animation id and restarts the grow-in, and
 * it hides every value label while one is running.
 */
const BAR_ANIMATION_MS = 650;

/**
 * Migration for the stored `totalView_chartColors` preference:
 *  - the oldest format stored a bare colour string per series,
 *  - later formats stored a partial SeriesStyle, merged over the defaults so
 *    fields added since the preference was written are picked up,
 *  - older versions also stored styles for the monthly plan and actual, which
 *    were never drawn; they are dropped.
 */
const migrateChartColors = (raw: unknown): ChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const parsed = raw as Partial<Record<PlottedSeries, unknown>>;

  const mergeSeries = (key: PlottedSeries): SeriesStyle => {
    const value = parsed[key];
    if (typeof value === 'string') return { ...DEFAULT_CHART_COLORS[key], color: value };
    if (value !== null && typeof value === 'object') {
      return { ...DEFAULT_CHART_COLORS[key], ...(value as Partial<SeriesStyle>) };
    }
    return DEFAULT_CHART_COLORS[key];
  };

  return { accPlan: mergeSeries('accPlan'), accActual: mergeSeries('accActual') };
};

/** Referentially stable so hooks that map over it can list it as a dependency. */
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * A difference with its sign, in the reader's convention: `-400` in English
 * and Vietnamese, `▲400` in Japanese, where the triangle is the minus sign.
 */
const signed = (delta: number, language: string, format: (value: number) => string): string => {
  const mark = formatVariance(delta, language, format);
  return language === 'ja' ? `${mark.arrow}${mark.text}` : mark.text;
};

/* --------------------------------------------------------------------------
 * Chart renderers
 *
 * These live at module scope on purpose. Declared inside TotalView they would be
 * a NEW component type on every render, so React would throw away the subtree —
 * and with it the pinned-card position and the bars' animation state. Recharts
 * injects its own props (x/y/value, payload) into the element passed to
 * `content=` / `shape=`, so everything from the view is threaded in explicitly.
 * ------------------------------------------------------------------------ */

/** Value label for a <LabelList content=…>, optionally outlined in the card colour. */
const OutlinedLabel = ({ x, y, value, dataKey, width = 0, chartColors, index, rows, nf, halo }: {
  x?: number;
  y?: number;
  value?: number | string;
  dataKey: PlottedSeries;
  width?: number;
  chartColors: ChartColors;
  /** Recharts supplies the datum's position; `rows` turns it back into the row. */
  index?: number;
  rows: TotalChartRow[];
  nf: (value: number) => string;
  halo: string;
}) => {
  if (!value || value === 0) return null;
  const style = chartColors[dataKey];
  if (!style) return null;
  const tx = typeof x === 'number' && typeof width === 'number' ? x + width / 2 : x;
  const ty = typeof y === 'number' ? y - 6 : y;
  const formatted = typeof value === 'number' ? nf(value) : value;
  const isFuture = typeof index === 'number' ? rows[index]?.isFuture === true : false;
  return (
    <g opacity={isFuture ? 0.55 : 1}>
      {style.stroke && (
        <text x={tx} y={ty} textAnchor="middle" fontSize={style.fontSize} fontWeight="bold" stroke={halo} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
          {formatted}
        </text>
      )}
      <text x={tx} y={ty} textAnchor="middle" fontSize={style.fontSize} fontWeight={style.bold ? 'bold' : 'normal'} fill={style.labelColor}>
        {formatted}
      </text>
    </g>
  );
};

/**
 * Where the year stands at `row`: accumulated actual against accumulated plan.
 *
 * Shared by the detail card and the summary line, so the two can never
 * disagree about the same month.
 */
const accumulatedGap = (row: TotalChartRow): { timeGap: number; percentGap: number } => {
  const accPlan = row.accPlan || 0;
  const timeGap = (row.accActual || 0) - accPlan;
  return { timeGap, percentGap: accPlan !== 0 ? (timeGap / accPlan) * 100 : 0 };
};

const gapTone = (gap: number) =>
  gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

/**
 * The chart's conclusion in one line, inside the capture target.
 *
 * Whether the year is ahead or behind is the question the chart exists to
 * answer, and a copied image carries no hover card. It reports the last month
 * with actual hours, so it does not swing on the forecast months to the right.
 */
const AccumulatedSummary = ({ row, t, language, nf, nfPct, unit }: {
  row: TotalChartRow;
  t: TranslateFn;
  language: string;
  nf: (value: number) => string;
  nfPct: (value: number) => string;
  unit: string;
}) => {
  const { timeGap, percentGap } = accumulatedGap(row);
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {t('totalView.summary.through', 'Through {month}').replace('{month}', row.fullName)}
      </span>
      <span>
        {t('tracker.actualShort', 'Actual')}{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{nf(row.accActual || 0)}</span>
        {' / '}
        {t('tracker.planShort', 'Plan')}{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{nf(row.accPlan || 0)}</span>{' '}
        {unit}
      </span>
      <span className={`font-semibold tabular-nums ${gapTone(timeGap)}`}>
        {signed(timeGap, language, nf)} {unit} ({signed(percentGap, language, nfPct)}%){' '}
        <span className="font-medium">
          {timeGap >= 0 ? t('totalView.summary.ahead', 'ahead of plan') : t('totalView.summary.behind', 'behind plan')}
        </span>
      </span>
    </p>
  );
};

const DetailRow = ({ label, value, unit, swatch }: {
  label: string;
  value: string;
  unit: string;
  swatch?: string;
}) => (
  <div className="flex items-center justify-between gap-6">
    <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
      {swatch && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: swatch }} />}
      {label}
    </span>
    <span className="whitespace-nowrap font-medium tabular-nums text-slate-900 dark:text-slate-100">
      {value} <span className="font-normal text-slate-500 dark:text-slate-400">{unit}</span>
    </span>
  </div>
);

/** The month breakdown: follows the cursor, or holds on a selected month. */
const MonthDetailCard = ({ data, chartColors, t, language, nf, nfPct, unit, onUnpin }: {
  data: TotalChartRow;
  chartColors: ChartColors;
  t: TranslateFn;
  language: string;
  nf: (value: number) => string;
  nfPct: (value: number) => string;
  unit: string;
  /** Only passed when the month is selected: releases the card. */
  onUnpin?: () => void;
}) => {
  const { timeGap, percentGap } = accumulatedGap(data);

  return (
    <div className="min-w-[232px] rounded-xl bg-white p-3 text-[13px] shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-white">{data.fullName}</span>
        <span className="flex items-center gap-1">
          {data.isFuture && <Badge tone="amber">{t('totalView.forecast', 'Forecast')}</Badge>}
          {/* The card belongs in an exported image — it says which month the
              chart is making a point about. Its close button does not. */}
          {onUnpin && (
            <button
              type="button"
              data-html2canvas-ignore="true"
              onClick={onUnpin}
              title={t('common.close', 'Close')}
              aria-label={t('common.close', 'Close')}
              className="pointer-events-auto -mr-1 grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <div className="space-y-1">
        <DetailRow label={t('dashboard.chart.accPlan', 'Cumulative plan')} value={nf(data.accPlan || 0)} unit={unit} swatch={chartColors.accPlan.color} />
        <DetailRow label={t('dashboard.chart.accActual', 'Cumulative actual')} value={nf(data.accActual || 0)} unit={unit} swatch={chartColors.accActual.color} />
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">{t('totalView.gap', 'Difference')}</span>
          <span className={`whitespace-nowrap font-semibold tabular-nums ${gapTone(timeGap)}`}>
            {signed(timeGap, language, nf)} {unit}
            <span className="ml-1.5 font-medium opacity-80">{signed(percentGap, language, nfPct)}%</span>
          </span>
        </div>
      </div>
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        <DetailRow label={t('totalView.monthPlan', 'Plan this month')} value={nf(data.plan || 0)} unit={unit} />
        <DetailRow label={t('totalView.monthActual', 'Actual this month')} value={nf(data.actual || 0)} unit={unit} />
      </div>
    </div>
  );
};

/**
 * Rounded bar that also reports each column's position, so the selected
 * month's card can be placed over the right bar.
 *
 * It reports through a callback rather than taking the ref: Recharts 3 keeps
 * chart props in an immer-backed store that DEEP-FREEZES what it is handed, so
 * a ref passed as a prop arrives with a frozen `.current` and the first write
 * throws. A callback closes over the ref instead.
 */
const TrackingBar = (props: {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fillOpacity?: number;
  payload?: TotalChartRow;
  seriesKey: PlottedSeries;
  onColumnMetrics: (seriesKey: PlottedSeries, month: number, box: ColumnBox) => void;
}) => {
  const { fill, x = 0, y = 0, width = 0, height = 0, payload, fillOpacity, seriesKey, onColumnMetrics } = props;
  if (payload?.month) {
    onColumnMetrics(seriesKey, payload.month, { x, y, width });
  }
  const r = 4;
  const path = `M${x},${y + height} L${x},${y + r} A${r},${r} 0 0,1 ${x + r},${y} L${x + width - r},${y} A${r},${r} 0 0,1 ${x + width},${y + r} L${x + width},${y + height} Z`;
  const d = height < r ? `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z` : path;
  // A month that has not happened yet is a plan, not a measurement. Drawing it
  // hollow says that quietly, and keeps the eye on the months with real data.
  if (payload?.isFuture) {
    return (
      <path
        d={d}
        fill={fill}
        fillOpacity={(fillOpacity ?? 1) * FORECAST_OPACITY}
        stroke={fill}
        strokeOpacity={0.65}
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />
    );
  }
  return <path d={d} stroke="none" fill={fill} fillOpacity={fillOpacity} />;
};

/** The chart's key, doubling as its filter: a chip hides or shows its series. */
const SeriesLegend = ({ chartColors, hidden, onToggle, labels, hint }: {
  chartColors: ChartColors;
  hidden: Record<PlottedSeries, boolean>;
  onToggle: (key: PlottedSeries) => void;
  labels: Record<PlottedSeries, string>;
  hint: string;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {PLOTTED_SERIES.map(key => {
      const shown = !hidden[key];
      return (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          title={hint}
          aria-pressed={shown}
          className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors ${
            shown
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              : 'text-slate-400 line-through ring-1 ring-inset ring-slate-200 hover:text-slate-600 dark:text-slate-500 dark:ring-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              backgroundColor: shown ? chartColors[key].color : 'transparent',
              boxShadow: `inset 0 0 0 1.5px ${chartColors[key].color}`,
            }}
          />
          {labels[key]}
        </button>
      );
    })}
  </div>
);

export const TotalView: React.FC<TotalViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { format: nf, formatDecimal: nfPct, localeTag } = useNumberFormat();
  const [allRecords, setAllRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  /** A failed load used to leave an empty grid behind a toast nobody saw. */
  const [loadError, setLoadError] = useState(false);
  /** After the first year has landed, later loads refresh in place. */
  const loadedOnceRef = useRef(false);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  // Hovering and selecting feed one card: the selection holds it on its month,
  // otherwise it follows the cursor.
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  // Read inside the mousemove handler, which must not be rebuilt per render.
  const hoveredMonthRef = useRef<number | null>(null);
  hoveredMonthRef.current = hoveredMonth;
  const pinnedMonthRef = useRef<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<PlottedSeries, boolean>>({
    accPlan: false,
    accActual: false,
  });
  // The bars grow in on mount and on every series toggle — but only then. The
  // rest of the time the animation is switched off, because a re-render
  // restarts it and blanks the value labels (a copy taken then lost them).
  const [barsAnimating, setBarsAnimating] = useState(true);
  const barsAnimatingRef = useRef(true);
  barsAnimatingRef.current = barsAnimating;
  const isDark = useIsDarkTheme();
  const axis = useMemo(() => chartTheme(isDark), [isDark]);
  const columnMetricsRef = useRef<Record<number, Partial<Record<PlottedSeries, ColumnBox>>>>({});
  const plotRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  /** Where the card points, in plot-local px: the cursor, or the bar it is pinned to. */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  // Read by the chart's mouse handlers, which must not be rebuilt on every
  // data change just to see the current rows.
  const chartDataRef = useRef<TotalChartRow[]>([]);
  const loadSeqRef = useRef(0);

  // The localStorage key is unchanged, so earlier picks survive (see `migrateChartColors`).
  const [chartColors, setChartColors, resetChartColors] = useChartPref<ChartColors>(
    'totalView_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  const updateSeries = useCallback((key: string, patch: Partial<SeriesStyle>) => {
    if (!PLOTTED_SERIES.includes(key as PlottedSeries)) return;
    setChartColors(prev => ({ ...prev, [key]: { ...prev[key as PlottedSeries], ...patch } }));
  }, [setChartColors]);

  const toggleSeries = useCallback((key: PlottedSeries) => {
    setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // See TrackingBar: the ref cannot cross into Recharts, a callback can.
  const recordColumnMetrics = useCallback((seriesKey: PlottedSeries, month: number, box: ColumnBox) => {
    const forMonth = columnMetricsRef.current[month] ?? (columnMetricsRef.current[month] = {});
    forMonth[seriesKey] = box;
  }, []);

  /**
   * Place the card beside its anchor: offset from the point, flipped to the
   * other side rather than pushed off the right edge, and kept inside the plot.
   *
   * Written straight to the DOM. The cursor moves far more often than the month
   * under it changes, and routing every pixel through React state would
   * re-render the whole chart.
   */
  const placeCard = useCallback(() => {
    const node = cardRef.current;
    const plot = plotRef.current;
    const anchor = anchorRef.current;
    if (!node || !plot || !anchor) return;

    const { width, height } = node.getBoundingClientRect();
    const maxX = plot.clientWidth;
    const maxY = plot.clientHeight;

    let x = anchor.x + CARD_OFFSET_PX;
    if (x + width > maxX) x = anchor.x - width - CARD_OFFSET_PX;
    x = Math.max(0, Math.min(x, Math.max(0, maxX - width)));

    let y = anchor.y + CARD_OFFSET_PX;
    y = Math.max(0, Math.min(y, Math.max(0, maxY - height)));

    node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }, []);

  /** Anchor for a month with no cursor on it: the top centre of its tallest bar. */
  const columnAnchor = useCallback((month: number, hidden: Record<PlottedSeries, boolean>) => {
    const boxes = PLOTTED_SERIES
      .filter(key => !hidden[key])
      .map(key => columnMetricsRef.current[month]?.[key])
      .filter((box): box is ColumnBox => box !== undefined);
    if (boxes.length === 0) return null;
    const left = Math.min(...boxes.map(b => b.x));
    const right = Math.max(...boxes.map(b => b.x + b.width));
    return { x: (left + right) / 2, y: Math.min(...boxes.map(b => b.y)) };
  }, []);

  /**
   * Recharts 3 `MouseHandlerDataParam` has no `activePayload`, so the month has
   * to be recovered from the active index.
   */
  const monthAtIndex = useCallback((rawIndex: unknown): number | null => {
    if (rawIndex === undefined || rawIndex === null) return null;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) return null;
    return chartDataRef.current[index]?.month ?? null;
  }, []);

  const unit = t('totalView.unit.hours', 'h');

  /**
   * Headings for the CSV, in the reader's own language.
   *
   * Also the field list: `name` duplicates `fullName` and `isFuture` is an
   * internal flag, and neither belongs in a file someone opens in Excel.
   */
  const csvColumns = useMemo(() => [
    { key: 'month', label: t('csv.month', 'Month') },
    { key: 'fullName', label: t('csv.monthName', 'Month name') },
    { key: 'plan', label: `${t('tracker.planShort', 'Plan')} (${unit})` },
    { key: 'actual', label: `${t('tracker.actualShort', 'Actual')} (${unit})` },
    { key: 'accPlan', label: `${t('dashboard.chart.accPlan', 'Cumulative plan')} (${unit})` },
    { key: 'accActual', label: `${t('dashboard.chart.accActual', 'Cumulative actual')} (${unit})` },
  ], [t, unit]);

  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);

  // Years can change faster than a request completes; the sequence number
  // drops any response that is no longer for the year on screen. `t` is read
  // through a ref so a language switch does not refetch the year.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * `silent` keeps whatever is on screen while the request runs.
   *
   * Saving hours in another view fires `dataUpdated`, and refetching loudly
   * meant a save in Tracking wiped this whole view back to a skeleton.
   */
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++loadSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const recordsData = await dbService.getAllRecords(currentYear);
      if (seq !== loadSeqRef.current) return;
      setAllRecords(recordsData);
      setLoadError(false);
      loadedOnceRef.current = true;
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data for Total View', error);
      setLoadError(true);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // In place: an edit somewhere else must not blank the chart being read.
    const handleDataUpdated = () => fetchData({ silent: true });
    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  const chartData = useMemo<TotalChartRow[]>(() => {
    const now = new Date();
    // Only the year in progress has a past and a future; a past year is all
    // history and a future one is all forecast.
    const lastRealMonth = now.getFullYear() === currentYear
      ? now.getMonth() + 1
      : now.getFullYear() > currentYear ? 12 : 0;

    const data: TotalChartRow[] = months.map(m => {
      const full = new Date(currentYear, m - 1).toLocaleString(localeTag, { month: 'long' });
      return {
        name: new Date(currentYear, m - 1).toLocaleString(localeTag, { month: 'short' }),
        fullName: full.charAt(0).toUpperCase() + full.slice(1),
        month: m,
        isFuture: m > lastRealMonth,
        plan: 0,
        actual: 0,
        accPlan: 0,
        accActual: 0,
      };
    });

    allRecords.forEach(r => {
      if (r.month >= 1 && r.month <= 12) {
        data[r.month - 1].plan += Number(r.planned_hours) || 0;
        data[r.month - 1].actual += Number(r.actual_hours) || 0;
      }
    });

    let runningPlan = 0;
    let runningActual = 0;
    data.forEach(d => {
      runningPlan += d.plan;
      runningActual += d.actual;
      d.accPlan = runningPlan;
      d.accActual = runningActual;
    });

    return data;
  }, [allRecords, currentYear, localeTag]);

  /**
   * The latest month with real hours in it. A year still in progress ends in
   * forecast months whose accumulated actual is flat, and summarising those
   * would report a gap that only grows because the year has not happened yet.
   */
  const summaryRow = useMemo(
    () => [...chartData].reverse().find(row => !row.isFuture && (row.accPlan > 0 || row.accActual > 0)) ?? null,
    [chartData]
  );
  const forecastMonths = chartData.filter(row => row.isFuture).length;

  chartDataRef.current = chartData;

  // A selected month outranks the cursor: that is what selecting it is for.
  const focusedMonth = pinnedMonth ?? hoveredMonth;
  const isPinned = pinnedMonth !== null;
  pinnedMonthRef.current = pinnedMonth;
  const focusedRow = focusedMonth === null
    ? null
    : chartData.find(d => d.month === focusedMonth) ?? null;

  const unpin = useCallback(() => {
    setPinnedMonth(null);
    setHoveredMonth(null);
  }, []);

  // Runs before paint, so the card is never shown at the wrong spot for a frame.
  // Following the cursor, the anchor is already set by the move that got us
  // here; pinned, it is the selected month's own bar.
  useLayoutEffect(() => {
    if (focusedMonth === null) return;
    if (isPinned) {
      const anchor = columnAnchor(focusedMonth, hiddenSeries);
      if (anchor) anchorRef.current = anchor;
    }
    placeCard();
  }, [focusedMonth, isPinned, hiddenSeries, chartData, columnAnchor, placeCard]);

  useMonthKeys(isPinned, setPinnedMonth, unpin);

  // Replay the grow-in when a series is switched on or off, or the data reloads.
  const firstPaintRef = useRef(true);
  useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false;
      return;
    }
    setBarsAnimating(true);
  }, [hiddenSeries, chartData]);

  // Recharts' own onAnimationEnd also fires when the animation is torn down, so
  // the window is timed here instead of being read back from the chart.
  useEffect(() => {
    if (!barsAnimating) return;
    const id = window.setTimeout(() => setBarsAnimating(false), BAR_ANIMATION_MS + 120);
    return () => window.clearTimeout(id);
  }, [barsAnimating]);

  /** Labels are hidden mid-grow-in, so settle the bars before any capture. */
  const settleBars = useCallback(() => setBarsAnimating(false), []);

  // Y axis in whole thousands, with room above the tallest bar for its label.
  const { yAxisMax, yAxisTicks } = useMemo(() => {
    const maxPlan = Math.max(0, ...chartData.map(d => d.accPlan || 0));
    const maxActual = Math.max(0, ...chartData.map(d => d.accActual || 0));
    const max = Math.max(maxPlan, maxActual);
    const maxLimit = max > 0 ? Math.ceil(max / 1000) * 1000 + 1000 : 20000;

    const ticks: number[] = [];
    const step = Math.ceil(maxLimit / 10 / 1000) * 1000 || 1000;
    for (let i = 0; i <= maxLimit; i += step) {
      ticks.push(i);
    }
    return { yAxisMax: maxLimit, yAxisTicks: ticks };
  }, [chartData]);

  const header = {
    title: t('nav.totalView', 'Cumulative hours'),
    description: t('totalView.desc', 'Whether the year’s hours are keeping up with the plan'),
    actions: (
      <>
        <YearControl />
        <YearExportButton />
      </>
    ),
  };

  if (loading && !loadedOnceRef.current) {
    return (
      <Page {...header}>
        <Card padding="lg" role="status" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
          <div aria-hidden="true">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            <Skeleton className="mt-6 h-[max(320px,calc(100dvh-17rem))] w-full" />
          </div>
        </Card>
      </Page>
    );
  }

  // A chart drawn against a fallback axis with no bars on it looks broken, and
  // looks exactly the same whether the year is empty or the request failed.
  if (loadError && !loading) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('empty.loadFailedTitle', 'Could not load this year')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <button type="button" onClick={() => fetchData()} className={buttonClasses('secondary')}>
                {t('buttons.retry', 'Try again')}
              </button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (allRecords.length === 0 && !loading) {
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

  const seriesLabels: Record<PlottedSeries, string> = {
    accPlan: t('dashboard.chart.accPlan', 'Cumulative plan'),
    accActual: t('dashboard.chart.accActual', 'Cumulative actual'),
  };
  const focusedName = focusedRow?.name;
  const currentMonthName = currentMonth !== null ? chartData[currentMonth - 1]?.name : undefined;

  return (
    <Page {...header}>
      {/* The card is the capture target: an exported image carries its title,
          year, conclusion and key along with the bars. */}
      <Card id="total-view-chart" padding="lg" className="animate-fade-up">
        <CardHeader
          title={<WithYear year={currentYear}>{t('totalView.chartTitle', 'Cumulative plan and actual')}</WithYear>}
          description={
            <>
              {t('totalView.chartDesc', 'Running totals of planned and actual hours')}
              {forecastMonths === 12
                ? <> · {t('totalView.allForecast', 'The whole year is forecast')}</>
                : forecastMonths > 0 && <> · {t('totalView.forecastNote', 'Months after this one are forecast')}</>}
            </>
          }
          actions={
            <>
              <div data-html2canvas-ignore="true">
                <Select
                  controlSize="sm"
                  aria-label={t('chart.monthDetailsHint', 'Show the numbers for one month')}
                  title={t('chart.monthDetailsHint', 'Show the numbers for one month')}
                  value={pinnedMonth ?? ''}
                  onChange={event => {
                    const month = event.target.value ? Number(event.target.value) : null;
                    if (month === null) {
                      unpin();
                      return;
                    }
                    setPinnedMonth(month);
                    setHoveredMonth(null);
                  }}
                  className="w-36"
                >
                  <option value="">{t('chart.monthDetails', 'Month details')}</option>
                  {chartData.map(d => (
                    <option key={d.month} value={d.month}>{d.fullName}</option>
                  ))}
                </Select>
              </div>
              <SeriesStyleButton
                series={PLOTTED_SERIES.map(key => ({ key, label: seriesLabels[key], style: chartColors[key] }))}
                onChange={updateSeries}
                onReset={() => {
                  resetChartColors();
                  setShowCurrentMonth(true);
                }}
                extra={currentMonth !== null && (
                  <SeriesStyleCheck checked={showCurrentMonth} onChange={setShowCurrentMonth}>
                    {t('chart.highlightCurrentMonth', 'Mark this month')}
                  </SeriesStyleCheck>
                )}
              />
              <ExportButton
                targetId="total-view-chart"
                filename={`yearly_overview_${currentYear}`}
                data={chartData}
                csvColumns={csvColumns}
                disabled={loading}
                onBeforeCapture={settleBars}
              />
            </>
          }
        />

        {loading && <RefreshBar className="mt-4" />}

        {/* The old year stays readable while the new one loads; it is dimmed so
            nobody reads it as the year they just picked. */}
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-40' : ''}`}>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            {summaryRow ? (
              <AccumulatedSummary row={summaryRow} t={t} language={language} nf={nf} nfPct={nfPct} unit={unit} />
            ) : <span />}
            <SeriesLegend
              chartColors={chartColors}
              hidden={hiddenSeries}
              onToggle={toggleSeries}
              labels={seriesLabels}
              hint={t('chart.toggleSeries', 'Show or hide this series')}
            />
          </div>

          {/* Narrow screens scroll the plot sideways rather than squeezing
              twelve months of labelled bars into a phone's width. */}
          <div className="-mx-2 mt-4 overflow-x-auto px-2 custom-scrollbar">
            <div ref={plotRef} className="relative h-[max(320px,calc(100dvh-20rem))] min-w-[600px]">
              {/* The one detail card. It follows the cursor over the plot and
                  parks on the selected month's bar; `placeCard` moves it. */}
              {focusedRow !== null && (
                <div ref={cardRef} className="pointer-events-none absolute left-0 top-0 z-10 will-change-transform">
                  <MonthDetailCard
                    data={focusedRow}
                    chartColors={chartColors}
                    t={t}
                    language={language}
                    nf={nf}
                    nfPct={nfPct}
                    unit={unit}
                    onUnpin={isPinned ? unpin : undefined}
                  />
                </div>
              )}

              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 34, right: 16, left: 0, bottom: 4 }}
                  aria-label={`${t('totalView.chartTitle', 'Cumulative plan and actual')} ${currentYear}`}
                  onClick={state => {
                    const clicked = monthAtIndex(state?.activeIndex);
                    if (clicked === null) return;
                    // Idempotent on purpose: toggling here meant a double-click
                    // selected and immediately released the month again.
                    setPinnedMonth(clicked);
                  }}
                  onMouseMove={(state, event) => {
                    // Selected means selected: the card holds its month and place.
                    if (pinnedMonthRef.current !== null) return;
                    // Moving over the chart mid-grow-in would restart it.
                    if (barsAnimatingRef.current) return;
                    const plot = plotRef.current;
                    const native = event as React.MouseEvent;
                    if (plot && typeof native?.clientX === 'number') {
                      const rect = plot.getBoundingClientRect();
                      anchorRef.current = { x: native.clientX - rect.left, y: native.clientY - rect.top };
                    }
                    const month = monthAtIndex(state?.activeIndex);
                    // Only the month goes through state; the position is written
                    // straight to the card so the chart is not re-rendered per pixel.
                    if (month === hoveredMonthRef.current) {
                      placeCard();
                      return;
                    }
                    setHoveredMonth(month);
                  }}
                  onMouseLeave={() => {
                    if (pinnedMonthRef.current === null) setHoveredMonth(null);
                  }}
                  className="cursor-pointer"
                >
                  {/* `yAxisId` is required: without it the grid looks for the
                      default axis id, finds none, and draws a single line. */}
                  <CartesianGrid yAxisId="left" vertical={false} stroke={axis.grid} strokeWidth={1} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tickMargin={8}
                    tickLine={false}
                    axisLine={{ stroke: axis.line }}
                    tick={{ fontSize: 13, fontWeight: 600, fill: axis.text }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, yAxisMax]}
                    ticks={yAxisTicks}
                    width={78}
                    tickMargin={6}
                    tickLine={false}
                    axisLine={{ stroke: axis.line }}
                    tick={{ fontSize: 12, fontWeight: 500, fill: axis.text }}
                    tickFormatter={nf}
                    label={{
                      value: `${t('totalView.axis.accumulated', 'Cumulative')} (${unit})`,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 13, fontWeight: 600, fill: axis.muted, textAnchor: 'middle' },
                    }}
                  />
                  {/* Stands in for a tooltip cursor: the month the card is about. */}
                  {focusedName && (
                    <ReferenceArea yAxisId="left" x1={focusedName} x2={focusedName} fill={axis.focus} />
                  )}
                  {showCurrentMonth && currentMonthName && (
                    <ReferenceLine
                      yAxisId="left"
                      x={currentMonthName}
                      stroke={axis.marker}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={<CurrentMonthBadge label={t('chart.thisMonth', 'This month')} color={axis.marker} />}
                    />
                  )}
                  {/* Animated only while `barsAnimating` is open: mount, a
                      legend toggle, a data reload. See BAR_ANIMATION_MS. */}
                  <Bar yAxisId="left" dataKey="accPlan" name={seriesLabels.accPlan} hide={hiddenSeries.accPlan} isAnimationActive={barsAnimating} animationDuration={BAR_ANIMATION_MS} animationEasing="ease-out" fill={chartColors.accPlan.color} fillOpacity={chartColors.accPlan.opacity} shape={<TrackingBar seriesKey="accPlan" onColumnMetrics={recordColumnMetrics} />}>
                    <LabelList dataKey="accPlan" position="top" content={<OutlinedLabel dataKey="accPlan" chartColors={chartColors} rows={chartData} nf={nf} halo={axis.halo} />} />
                  </Bar>
                  {/* Same shape as the plan bar so this series reports column
                      positions too — otherwise hiding the plan series would
                      leave the detail card with nowhere to anchor. */}
                  <Bar yAxisId="left" dataKey="accActual" name={seriesLabels.accActual} hide={hiddenSeries.accActual} isAnimationActive={barsAnimating} animationDuration={BAR_ANIMATION_MS} animationEasing="ease-out" fill={chartColors.accActual.color} fillOpacity={chartColors.accActual.opacity} shape={<TrackingBar seriesKey="accActual" onColumnMetrics={recordColumnMetrics} />}>
                    <LabelList dataKey="accActual" position="top" content={<OutlinedLabel dataKey="accActual" chartColors={chartColors} rows={chartData} nf={nf} halo={axis.halo} />} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  );
};
