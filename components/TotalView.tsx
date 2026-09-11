import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
import { TrendingUp, Download, Palette, Copy, Check, Image } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslateFn } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useChartPref, CHART_PALETTE } from '../utils/chartColorPrefs';
import { Skeleton } from './ui/Skeleton';
import { useIsDarkTheme } from '../hooks/useDarkMode';
import { ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, TooltipContentProps, ReferenceLine } from 'recharts';
import { createLogger } from '../utils/logger';

const log = createLogger('TotalView');

interface TotalViewProps {
  currentYear: number;
}

interface SeriesStyle {
  color: string;
  opacity: number;
  labelColor: string;
  fontSize: number;
  bold: boolean;
  stroke: boolean;
}

interface ChartColors {
  plan: SeriesStyle;
  actual: SeriesStyle;
  accPlan: SeriesStyle;
  accActual: SeriesStyle;
}

/** One point of the monthly chart. */
interface TotalChartRow {
  name: string;
  /** Unabbreviated month, for the tooltip heading — "Tháng 9", not "thg 9". */
  fullName: string;
  month: number;
  /** After the current month: planned but not yet worked. */
  isFuture: boolean;
  plan: number;
  actual: number;
  accPlan: number;
  accActual: number;
}

/** Theme-safe mid-tones (U8) — legible on both bg-white and bg-slate-900. */
const DEFAULT_CHART_COLORS: ChartColors = {
  plan: { color: CHART_PALETTE.neutral, opacity: 1, labelColor: CHART_PALETTE.labelNeutral, fontSize: 10, bold: true, stroke: false },
  actual: { color: CHART_PALETTE.plan, opacity: 1, labelColor: CHART_PALETTE.plan, fontSize: 10, bold: true, stroke: false },
  accPlan: { color: CHART_PALETTE.labelNeutral, opacity: 1, labelColor: CHART_PALETTE.labelNeutral, fontSize: 10, bold: false, stroke: false },
  accActual: { color: CHART_PALETTE.actual, opacity: 1, labelColor: CHART_PALETTE.actual, fontSize: 12, bold: true, stroke: true },
};

const SERIES_KEYS = ['plan', 'actual', 'accPlan', 'accActual'] as const;

/** The two series the chart actually draws, and so the ones the legend filters. */
const PLOTTED_SERIES = ['accPlan', 'accActual'] as const;
type PlottedSeries = (typeof PLOTTED_SERIES)[number];

/** A forecast month is drawn as an outline at this opacity rather than solid. */
const FORECAST_OPACITY = 0.3;

/**
 * Axis, grid and marker colours.
 *
 * These cannot be Tailwind `dark:` classes: every one of them is an SVG
 * `fill`/`stroke` prop that Recharts passes straight to the element.
 */
const axisTheme = (isDark: boolean) => ({
  text: isDark ? '#e2e8f0' : '#334155',
  muted: isDark ? '#94a3b8' : '#475569',
  line: isDark ? '#475569' : '#cbd5e1',
  // Thin but readable: a solid hairline reads more clearly across a wide plot
  // than the old 3-3 dash, without adding weight.
  grid: isDark ? 'rgba(148,163,184,0.32)' : 'rgba(100,116,139,0.26)',
  marker: '#f97316',
});

/**
 * Migration for the stored `totalView_chartColors` preference:
 *  - the oldest format stored a bare colour string per series,
 *  - later formats stored a partial SeriesStyle, which is merged over the defaults so
 *    fields added since the preference was written are picked up.
 */
const migrateChartColors = (raw: unknown): ChartColors | null => {
  if (raw === null || typeof raw !== 'object') return null;
  const parsed = raw as Partial<Record<keyof ChartColors, unknown>>;

  const mergeSeries = (key: keyof ChartColors): SeriesStyle => {
    const value = parsed[key];
    if (typeof value === 'string') return { ...DEFAULT_CHART_COLORS[key], color: value };
    if (value !== null && typeof value === 'object') {
      return { ...DEFAULT_CHART_COLORS[key], ...(value as Partial<SeriesStyle>) };
    }
    return DEFAULT_CHART_COLORS[key];
  };

  return {
    plan: mergeSeries('plan'),
    actual: mergeSeries('actual'),
    accPlan: mergeSeries('accPlan'),
    accActual: mergeSeries('accActual'),
  };
};

/** Referentially stable so hooks that map over it can list it as a dependency. */
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* --------------------------------------------------------------------------
 * Chart renderers
 *
 * These live at module scope on purpose. Declared inside TotalView they would be
 * a NEW component type on every render, so React would throw away the subtree —
 * and with it the pinned-card position and the bars' animation state. Recharts
 * injects its own props (x/y/value, payload) into the element passed to
 * `content=` / `shape=`, so everything from the view is threaded in explicitly.
 * ------------------------------------------------------------------------ */

/** Outlined label renderer for a <LabelList content=…>. */
const OutlinedLabel = ({ x, y, value, dataKey, width = 0, chartColors, index, rows, nf }: {
  x?: number;
  y?: number;
  value?: number | string;
  dataKey: keyof ChartColors;
  width?: number;
  chartColors: ChartColors;
  /** Recharts supplies the datum's position; `rows` turns it back into the row. */
  index?: number;
  rows: TotalChartRow[];
  nf: (value: number) => string;
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
        <text x={tx} y={ty} textAnchor="middle" fontSize={style.fontSize} fontWeight="bold" stroke="white" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
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
 * "This month" marker.
 *
 * A small pill sitting on top of a hairline at the month the year is currently
 * at, replacing the full-height tinted band that used to wash out a whole
 * column of bars.
 */
const CurrentMonthBadge = ({ viewBox, label, color }: {
  viewBox?: { x?: number; y?: number };
  label: string;
  color: string;
}) => {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const height = 18;
  const width = Math.max(52, label.length * 7.5 + 16);
  return (
    <g transform={`translate(${x - width / 2}, ${y - height - 6})`}>
      <rect width={width} height={height} rx={height / 2} fill={color} />
      <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#ffffff">
        {label}
      </text>
    </g>
  );
};

/** The month breakdown, shown both in the tooltip and in the pinned card. */
const MonthDetailCard = ({ data, chartColors, t, nf, unit, hideShadow = false }: {
  data: TotalChartRow;
  chartColors: ChartColors;
  t: TranslateFn;
  /** Formats in the UI language, so 9600 reads 9.600 in vi and 9,600 in en. */
  nf: (value: number) => string;
  unit: string;
  hideShadow?: boolean;
}) => {
  const plan = data.plan || 0;
  const actual = data.actual || 0;
  const accPlan = data.accPlan || 0;
  const accActual = data.accActual || 0;

  const timeGap = accActual - accPlan;
  const percentGap = accPlan !== 0 ? ((timeGap / accPlan) * 100) : 0;

  return (
    <div className={`bg-white dark:bg-slate-900 p-3 border border-slate-300 dark:border-slate-700 rounded-lg min-w-[200px] ${hideShadow ? '' : 'shadow-lg'}`}>
      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between gap-2">
        <span>{data.fullName}</span>
        {data.isFuture && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {t('totalView.forecast', 'Forecast')}
          </span>
        )}
      </p>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.plan.color }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('tracker.planShort')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{nf(plan)} <span className="text-slate-500 dark:text-slate-400 font-normal">{unit}</span></span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: chartColors.actual.color }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('tracker.actualShort')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{nf(actual)} <span className="text-slate-500 dark:text-slate-400 font-normal">{unit}</span></span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accPlan.color }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('dashboard.chart.accPlan')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{nf(accPlan)} <span className="text-slate-500 dark:text-slate-400 font-normal">{unit}</span></span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2" style={{ borderColor: chartColors.accActual.color }}></div>
            <span className="text-slate-700 dark:text-slate-400">{t('dashboard.chart.accActual')}:</span>
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">{nf(accActual)} <span className="text-slate-500 dark:text-slate-400 font-normal">{unit}</span></span>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-700 dark:text-slate-400 font-medium">{t('totalView.timeGap', '時間 GAP')}:</span>
            <span className={`font-semibold tabular-nums ${timeGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {timeGap >= 0 ? '+' : ''}{nf(timeGap)} <span className="font-normal opacity-80">{unit}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-700 dark:text-slate-400 font-medium">{t('totalView.percentGap', '% GAP')}:</span>
            <span className={`font-semibold ${percentGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {percentGap >= 0 ? '+' : ''}{percentGap.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Tooltip body. Recharts 3 fills in `active` / `payload` when it clones the
 * element, which is why they are optional here.
 */
const CustomTooltip = ({ active, payload, chartColors, t, nf, unit }: Partial<TooltipContentProps<number, string>> & {
  chartColors: ChartColors;
  t: TranslateFn;
  nf: (value: number) => string;
  unit: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as TotalChartRow | undefined;
  if (!data) return null;
  return <MonthDetailCard data={data} chartColors={chartColors} t={t} nf={nf} unit={unit} />;
};

/**
  * Rounded bar that also reports each column's centre x, so the pinned card can
  * be positioned under the right month.
  *
  * It reports through a callback rather than taking the ref: Recharts 3 keeps
  * chart props in an immer-backed store that DEEP-FREEZES what it is handed, so
  * a ref passed as a prop arrives with a frozen `.current` and the first write
  * throws. A callback closes over the ref instead — only the function object is
  * frozen, which is harmless.
  */
const TrackingBar = (props: {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fillOpacity?: number;
  payload?: TotalChartRow;
  onColumnCoord: (month: number, centerX: number) => void;
}) => {
  const { fill, x = 0, y = 0, width = 0, height = 0, payload, fillOpacity, onColumnCoord } = props;
  if (payload?.month) {
    onColumnCoord(payload.month, x + width / 2);
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

/**
 * Legend, top-right, doubling as the series filter — clicking a chip hides or
 * shows that series. It lives in the header rather than under the plot so the
 * chart keeps its full height and the key is read before the bars, not after.
 */
const SeriesLegend = ({ chartColors, hidden, onToggle, labels, hint }: {
  chartColors: ChartColors;
  hidden: Record<PlottedSeries, boolean>;
  onToggle: (key: PlottedSeries) => void;
  labels: Record<PlottedSeries, string>;
  hint: string;
}) => (
  <div className="flex items-center gap-2">
    {PLOTTED_SERIES.map(key => {
      const shown = !hidden[key];
      return (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          title={hint}
          aria-pressed={shown}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
            shown
              ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              : 'border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500'
          }`}
        >
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              backgroundColor: shown ? chartColors[key].color : 'transparent',
              border: `2px solid ${chartColors[key].color}`,
              opacity: shown ? 1 : 0.5,
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
  const [allRecords, setAllRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // Copying runs a full html2canvas capture; without an in-flight guard a double
  // click queued a second one, and the button gave no sign it had done anything.
  const [copyState, setCopyState] = useState<'idle' | 'busy' | 'done'>('idle');
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<PlottedSeries, boolean>>({
    accPlan: false,
    accActual: false,
  });
  const isDark = useIsDarkTheme();
  const axis = useMemo(() => axisTheme(isDark), [isDark]);
  const columnCoordsRef = useRef<Record<number, number>>({});
  const loadSeqRef = useRef(0);

  // Colours live behind the shared preference helper (U8): the localStorage key is unchanged
  // so existing user picks survive (see `migrateChartColors`), and every set() persists.
  const [chartColors, setChartColors] = useChartPref<ChartColors>(
    'totalView_chartColors',
    DEFAULT_CHART_COLORS,
    migrateChartColors,
  );

  const updateColor = <K extends keyof SeriesStyle>(seriesKey: keyof ChartColors, field: K, value: SeriesStyle[K]) => {
    setChartColors(prev => {
      const updated: SeriesStyle = { ...prev[seriesKey] };
      updated[field] = value;
      return { ...prev, [seriesKey]: updated };
    });
  };

  const toggleSeries = useCallback((key: PlottedSeries) => {
    setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // See TrackingBar: the ref cannot cross into Recharts, a callback can.
  const recordColumnCoord = useCallback((month: number, centerX: number) => {
    columnCoordsRef.current[month] = centerX;
  }, []);

  const localeTag = language === 'ja' ? 'ja-JP' : language === 'vn' ? 'vi-VN' : 'en-US';
  // Every number in the chart goes through this, so the separators follow the
  // UI language (9.600 in Vietnamese, 9,600 in English) instead of the browser's.
  const nf = useCallback(
    (value: number) => new Intl.NumberFormat(localeTag).format(value),
    [localeTag]
  );
  const unit = t('totalView.unit.hours', 'h');

  // Current month highlight
  const currentMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;
  const [showCurrentMonth, setShowCurrentMonth] = useState(true);

  // U1 routed every view's year through one shell control, so a user can change
  // year faster than a request completes. Without this guard an older response
  // lands after a newer one and the view shows the wrong year's numbers.
  // `t` is memoised per language, so making it a dependency of the fetch would
  // refetch the year's data on every language switch. The ref keeps the error
  // toast localised without tying data loading to the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // The 2s "Copied!" reset must not fire into an unmounted view.
  useEffect(() => () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
  }, []);

  const fetchData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const recordsData = await dbService.getAllRecords(currentYear);
      if (seq !== loadSeqRef.current) return;
      setAllRecords(recordsData);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data for Total View', error);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for data updates from other tabs
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchData();
    };

    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  // Chart Data Preparation
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
        accActual: 0
      };
    });

    // Aggregate monthly totals from all records directly
    allRecords.forEach(r => {
      if (r.month >= 1 && r.month <= 12) {
        data[r.month - 1].plan += Number(r.planned_hours) || 0;
        data[r.month - 1].actual += Number(r.actual_hours) || 0;
      }
    });

    // Calculate accumulations
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

  // Dynamic Y-axis max based on max accumulated values
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

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col gap-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="flex-1 min-h-[240px] w-full" />
          <span className="sr-only text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">

      {/* 1. Chart Section - Full Page */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-end mb-2 flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 outline-none"
              value={pinnedMonth ?? ""}
              onChange={(e) => {
                const month = e.target.value ? Number(e.target.value) : null;
                setPinnedMonth(month);
              }}
            >
              <option value="">{t('tracker.selectMonth', '月を選択...')}</option>
              {chartData.map((d) => (
                <option key={d.month} value={d.month}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
              title={t('chart.customizeColors', 'Customize chart colors')}
            >
              <Palette className="w-4 h-4" />
              {t('chart.colors', 'Colors')}
            </button>
            <button
              onClick={() => {
                if (copyState === 'busy') return;
                setCopyState('busy');
                // Not awaited before the call: copyChartToClipboard must reach
                // the clipboard from inside this click.
                copyChartToClipboard('total-view-chart').then(ok => {
                  setCopyState(ok ? 'done' : 'idle');
                  if (!ok) return;
                  if (copyResetRef.current) clearTimeout(copyResetRef.current);
                  copyResetRef.current = setTimeout(() => setCopyState('idle'), 2000);
                });
              }}
              disabled={copyState === 'busy'}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-60"
              title={t('export.copyAsImage', 'Copy to Clipboard')}
            >
              {copyState === 'done' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copyState === 'busy'
                ? t('common.loading', 'Loading…')
                : copyState === 'done'
                  ? t('export.copied', 'Copied!')
                  : t('buttons.copy', 'Copy')}
            </button>
            <button
              onClick={() => exportChartToPNG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'png'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-rose-600 dark:bg-rose-700 text-white rounded-lg hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors"
              title={t('export.savePNG', 'Save as PNG')}
            >
              <Image className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => exportChartToSVG('total-view-chart', generateChartFilename(`yearly_overview_${currentYear}`, 'svg'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
              title={t('export.saveSVG', 'Save as SVG')}
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={() => exportChartDataToCSV(chartData, generateChartFilename(`yearly_data_${currentYear}`, 'csv'))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              title={t('export.downloadData', 'Download Data (Excel/CSV)')}
            >
              <Download className="w-4 h-4" />
              {t('chart.dataCsv', 'Data')}
            </button>
          </div>
        </div>

        {/* Color Picker Section */}
        {showColorPicker && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {t('chart.customizeColors', 'Customize chart colors')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SERIES_KEYS.map((key) => {
                const label = key === 'plan'
                  ? t('tracker.planShort')
                  : key === 'actual'
                    ? t('tracker.actualShort')
                    : key === 'accPlan'
                      ? t('dashboard.chart.accPlan')
                      : t('dashboard.chart.accActual');
                const style = chartColors[key];
                return (
                  <div key={key} className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{label}</label>

                    {/* Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.color', 'Color')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" aria-label={label} value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" aria-label={label} value={style.color} onChange={(e) => updateColor(key, 'color', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Opacity Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.alpha', 'Alpha')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="0" max="1" step="0.1" value={style.opacity} onChange={(e) => updateColor(key, 'opacity', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium text-slate-600 dark:text-slate-300">{Math.round(style.opacity * 100)}%</span>
                      </div>
                    </div>

                    {/* Label Color Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.text', 'Text')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="color" aria-label={label} value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer p-0 border-0" />
                        <input type="text" aria-label={label} value={style.labelColor} onChange={(e) => updateColor(key, 'labelColor', e.target.value)} className="flex-1 w-full px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded" />
                      </div>
                    </div>

                    {/* Font Size Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-8">{t('chart.field.size', 'Size')}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <input type="range" min="8" max="20" step="1" value={style.fontSize} onChange={(e) => updateColor(key, 'fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-[10px] w-5 text-right font-medium text-slate-600 dark:text-slate-300">{style.fontSize}</span>
                      </div>
                    </div>

                    {/* Bold + Stroke Row */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.bold} onChange={(e) => updateColor(key, 'bold', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{t('chart.field.bold', 'Bold')}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={style.stroke} onChange={(e) => updateColor(key, 'stroke', e.target.checked)} className="w-3 h-3" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">{t('chart.field.outline', 'Outline')}</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global: Highlight Current Month */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCurrentMonth} onChange={(e) => setShowCurrentMonth(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('chart.highlightCurrentMonth', 'Highlight current month')}</span>
              </label>
            </div>
          </div>
        )}
        <div id="total-view-chart" className="flex-1 min-h-0 relative flex flex-col">

          {/* Title and legend sit INSIDE the capture target, so an exported or
              copied image carries its own heading and key. */}
          <div className="flex items-start justify-between gap-4 flex-wrap px-1 pb-3">
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 shrink-0 text-blue-600 dark:text-blue-400" />
                {t('totalView.chartTitle')} — {currentYear}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('totalView.axis.accumulated')} ({unit}) · {t('totalView.forecastNote', 'Months after the current one are forecast')}
              </p>
            </div>
            <SeriesLegend
              chartColors={chartColors}
              hidden={hiddenSeries}
              onToggle={toggleSeries}
              labels={{ accPlan: t('dashboard.chart.accPlan'), accActual: t('dashboard.chart.accActual') }}
              hint={t('chart.toggleSeries', 'Click to show or hide a series')}
            />
          </div>

          <div className="flex-1 min-h-0 relative">

          {/* Pinned Detail Card Overlay */}
          {pinnedMonth !== null && (() => {
            const pinnedData = chartData.find((d) => d.month === pinnedMonth);
            if (!pinnedData) return null;

            const isCardOnLeft = pinnedMonth > 8;
            const targetX = columnCoordsRef.current[pinnedMonth] || 100;
            const cardX = isCardOnLeft ? targetX - 230 : targetX + 40;

            return (
              <div
                className="absolute z-10 pointer-events-none transition-all duration-200 ease-in-out drop-shadow-md"
                style={{
                  left: cardX,
                  top: '40%',
                  transform: 'translateY(-50%)'
                }}
              >
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white dark:bg-slate-900 transform rotate-45 pointer-events-none ${
                    isCardOnLeft
                      ? '-right-[7px] border-t border-r border-slate-300 dark:border-slate-700'
                      : '-left-[7px] border-b border-l border-slate-300 dark:border-slate-700'
                  }`}
                  style={{ zIndex: 0 }}
                />
                <div className="relative z-10">
                  <MonthDetailCard data={pinnedData} chartColors={chartColors} t={t} nf={nf} unit={unit} hideShadow={true} />
                </div>
              </div>
            );
          })()}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 34, right: 30, left: 8, bottom: 8 }}
              onClick={(state) => {
                // recharts 3 `MouseHandlerDataParam` has no `activePayload` — recover the
                // clicked datum from the active index instead.
                const rawIndex = state?.activeIndex;
                if (rawIndex === undefined || rawIndex === null) return;
                const index = Number(rawIndex);
                if (!Number.isInteger(index) || index < 0) return;
                const clicked = chartData[index];
                if (!clicked) return;
                setPinnedMonth(prev => (prev === clicked.month ? null : clicked.month));
              }}
            >
              {/* `yAxisId` is required: without it the grid looks for the default
                  axis id, finds none, and draws a single line at the top. */}
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
                  value: `${t('totalView.axis.accumulated')} (${unit})`,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 13, fontWeight: 600, fill: axis.muted, textAnchor: 'middle' },
                }}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.08)' }}
                content={<CustomTooltip chartColors={chartColors} t={t} nf={nf} unit={unit} />}
              />
              {/* Current month: a hairline plus a pill, not a full-height band. */}
              {showCurrentMonth && currentMonth !== null && (() => {
                const monthName = chartData.find(d => d.month === currentMonth)?.name;
                return monthName ? (
                  <ReferenceLine
                    yAxisId="left"
                    x={monthName}
                    stroke={axis.marker}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={<CurrentMonthBadge label={t('chart.thisMonth', '今月')} color={axis.marker} />}
                  />
                ) : null;
              })()}
              <Bar yAxisId="left" dataKey="accPlan" name={t('dashboard.chart.accPlan')} hide={hiddenSeries.accPlan} fill={chartColors.accPlan.color} fillOpacity={chartColors.accPlan.opacity} shape={<TrackingBar onColumnCoord={recordColumnCoord} />}>
                <LabelList dataKey="accPlan" position="top" content={<OutlinedLabel dataKey="accPlan" chartColors={chartColors} rows={chartData} nf={nf} />} />
              </Bar>
              <Bar yAxisId="left" dataKey="accActual" name={t('dashboard.chart.accActual')} hide={hiddenSeries.accActual} fill={chartColors.accActual.color} fillOpacity={chartColors.accActual.opacity} radius={[4, 4, 0, 0]}>
                {chartData.map(row => (
                  <Cell
                    key={row.month}
                    fillOpacity={row.isFuture ? chartColors.accActual.opacity * FORECAST_OPACITY : chartColors.accActual.opacity}
                  />
                ))}
                <LabelList dataKey="accActual" position="top" content={<OutlinedLabel dataKey="accActual" chartColors={chartColors} rows={chartData} nf={nf} />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. Table Section Removed - check YearlyDataView.tsx */}
    </div>
  );
};
